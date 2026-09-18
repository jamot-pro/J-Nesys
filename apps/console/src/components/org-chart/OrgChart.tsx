"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type OnNodeDrag,
} from "@xyflow/react";
import {
  Bot,
  Building2,
  GitMerge,
  HeartPulse,
  Loader2,
  Moon,
  Network,
  ShieldCheck,
  User,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  addOrganizationMember,
  createOrgEdge,
  createOrgNode,
  deleteOrgEdge,
  getOrgGraph,
  getReadiness,
  type OrgEdgeRelation,
  type OrgGraph,
  type OrgNode,
  type OrgNodeKind,
  type ReadinessReport,
} from "@/lib/api-client";
import {
  KIND_LABEL,
  PARENT_RELATIONS,
  RELATION_LABEL,
  sampleGraph,
  type ChangeRequest,
} from "./org-data";
import { ChangeProposal } from "./ChangeProposal";
import { NodeDrawer } from "./NodeDrawer";
import { ContextMenu, type ContextAction, type ContextMenuState } from "./ContextMenu";
import { RelationPicker, type RelationPick } from "./RelationPicker";
import { ReadinessPanel } from "./ReadinessPanel";
import { ChartErrorBoundary } from "./ChartErrorBoundary";
import { installGlobalErrorReporting } from "@/lib/report-error";

const NODE_WIDTH = 208;
const NODE_HEIGHT = 72;
const LEVEL_HEIGHT = 160;
const H_GAP = 48;

type OrgNodeData = {
  label: string;
  kind: OrgNodeKind;
  refId: string | null;
  config: Record<string, unknown>;
  parentId: string | null;
  [key: string]: unknown;
};

type OrgFlowNode = Node<OrgNodeData, "org">;

const KIND_ICON: Record<OrgNodeKind, LucideIcon> = {
  dream: Moon,
  team: Building2,
  human: User,
  agent: Bot,
  responsibility: ShieldCheck,
  tool: Wrench,
  heartbeat: HeartPulse,
};

const MINIMAP_COLORS: Record<OrgNodeKind, string> = {
  dream: "#8b5cf6",
  team: "#14b8a6",
  human: "#0ea5e9",
  agent: "#10b981",
  responsibility: "#f59e0b",
  tool: "#a1a1aa",
  heartbeat: "#f43f5e",
};

const LEAF_KINDS: OrgNodeKind[] = [
  "human",
  "agent",
  "responsibility",
  "tool",
  "heartbeat",
];

function OrgNodeCard({ data, selected }: NodeProps<OrgFlowNode>) {
  const Icon = KIND_ICON[data.kind];
  const kindLabel = KIND_LABEL[data.kind];
  const isLeaf = LEAF_KINDS.includes(data.kind);

  return (
    <div
      className={cn(
        "w-[208px] rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-shadow",
        selected && "shadow-md ring-1 ring-ring",
        data.kind === "dream" && "border-space-accent/40 bg-space-accent/10",
        data.kind === "team" && "border-border bg-muted/40",
        data.kind === "agent" && "border-space-accent/30 bg-space-accent/5",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable
        style={{ opacity: 0, width: 8, height: 8 }}
      />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            "bg-muted text-muted-foreground",
            data.kind === "agent" && "bg-space-accent/15 text-space-accent",
            data.kind === "dream" && "bg-space-accent text-space-accent-foreground",
            data.kind === "heartbeat" && "bg-rose-500/15 text-rose-400",
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{data.label}</span>
        {isLeaf ? (
          <Badge variant="outline" className="px-1.5 text-[10px]">
            {kindLabel}
          </Badge>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable
        style={{ opacity: 0, width: 8, height: 8 }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = { org: OrgNodeCard };

function buildParentMap(nodes: OrgFlowNode[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const node of nodes) map.set(node.id, node.data.parentId ?? null);
  return map;
}

function computeLayout(nodes: OrgFlowNode[]): Map<string, { x: number; y: number }> {
  const parentOf = buildParentMap(nodes);
  const childrenOf = new Map<string, OrgFlowNode[]>();
  for (const node of nodes) {
    const parent = parentOf.get(node.id) ?? null;
    if (parent) {
      const list = childrenOf.get(parent) ?? [];
      list.push(node);
      childrenOf.set(parent, list);
    }
  }
  const roots = nodes.filter((node) => !parentOf.get(node.id));

  const depthOf = new Map<string, number>();
  const visited = new Set<string>();
  const assignDepth = (node: OrgFlowNode, depth: number) => {
    if (visited.has(node.id)) return; // guard against parent cycles
    visited.add(node.id);
    depthOf.set(node.id, depth);
    for (const child of childrenOf.get(node.id) ?? []) assignDepth(child, depth + 1);
  };
  for (const root of roots) assignDepth(root, 0);

  let cursor = 0;
  const xOf = new Map<string, number>();
  const placed = new Set<string>();
  const place = (node: OrgFlowNode): number => {
    const kids = childrenOf.get(node.id) ?? [];
    let center: number;
    if (kids.length === 0 || placed.has(node.id)) {
      center = cursor + NODE_WIDTH / 2;
      cursor += NODE_WIDTH + H_GAP;
      placed.add(node.id);
    } else {
      placed.add(node.id);
      const xs = kids.map(place);
      center = (xs[0] + xs[xs.length - 1]) / 2;
    }
    xOf.set(node.id, center);
    return center;
  };
  for (const root of roots) place(root);

  const layout = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    layout.set(node.id, {
      x: (xOf.get(node.id) ?? 0) - NODE_WIDTH / 2,
      y: (depthOf.get(node.id) ?? 0) * LEVEL_HEIGHT,
    });
  }
  return layout;
}

function deriveParentId(graph: OrgGraph): Map<string, string | null> {
  const byId = new Map<string, OrgNode>(graph.nodes.map((node) => [node.id, node]));
  const parent = new Map<string, string | null>();
  for (const node of graph.nodes) {
    if (node.kind === "dream") {
      parent.set(node.id, null);
      continue;
    }
    const incoming = graph.edges
      .filter(
        (edge) =>
          edge.toNodeId === node.id && PARENT_RELATIONS.includes(edge.relation),
      )
      .sort(
        (a, b) =>
          PARENT_RELATIONS.indexOf(a.relation) - PARENT_RELATIONS.indexOf(b.relation),
      );
    const parentEdge = incoming.find((edge) => {
      const source = byId.get(edge.fromNodeId);
      return source && (source.kind === "dream" || source.kind === "team");
    });
    parent.set(node.id, parentEdge?.fromNodeId ?? null);
  }
  return parent;
}

function buildFlow(graph: OrgGraph): { nodes: OrgFlowNode[]; edges: Edge[] } {
  const parentMap = deriveParentId(graph);
  const nodes: OrgFlowNode[] = graph.nodes.map((node) => ({
    id: node.id,
    type: "org",
    draggable: node.kind !== "dream",
    data: {
      label: node.name,
      kind: node.kind,
      refId: node.refId,
      config: node.config,
      parentId: parentMap.get(node.id) ?? null,
    },
    position: { x: 0, y: 0 },
  }));

  const layout = computeLayout(nodes);
  const positioned = nodes.map((node) => {
    const position = layout.get(node.id) ?? node.position;
    return { ...node, position };
  });

  const edges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.fromNodeId,
    target: edge.toNodeId,
    type: "smoothstep",
    label: RELATION_LABEL[edge.relation] ?? edge.relation,
    data: {
      relation: edge.relation,
      edgeId: edge.id,
      metadata: edge.metadata,
    },
    style: { stroke: "var(--muted-foreground)", strokeWidth: 1.5 },
  }));

  return { nodes: positioned, edges };
}

const LEGEND: { kind: OrgNodeKind; color: string }[] = [
  { kind: "dream", color: "#8b5cf6" },
  { kind: "team", color: "#14b8a6" },
  { kind: "human", color: "#0ea5e9" },
  { kind: "agent", color: "#10b981" },
  { kind: "responsibility", color: "#f59e0b" },
  { kind: "tool", color: "#a1a1aa" },
  { kind: "heartbeat", color: "#f43f5e" },
];

function Legend() {
  return (
    <Panel
      position="top-left"
      className="pointer-events-none rounded-lg border border-border bg-card/80 p-2 backdrop-blur"
    >
      <ul className="flex flex-col gap-1">
        {LEGEND.map((item) => (
          <li key={item.kind} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {KIND_LABEL[item.kind]}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function OrgChart({ orgId }: { orgId: string }) {
  useEffect(() => {
    installGlobalErrorReporting();
  }, []);

  return (
    <ChartErrorBoundary>
      <ReactFlowProvider>
        <OrgChartInner orgId={orgId} />
      </ReactFlowProvider>
    </ChartErrorBoundary>
  );
}

function OrgChartInner({ orgId }: { orgId: string }) {
  const [graph, setGraph] = useState<OrgGraph>(sampleGraph);
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ChangeRequest | null>(null);
  const [connectPick, setConnectPick] = useState<RelationPick | null>(null);
  const [connectExistingFrom, setConnectExistingFrom] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const { getIntersectingNodes, screenToFlowPosition } = useReactFlow<OrgFlowNode>();

  const applyGraph = useCallback(
    (next: OrgGraph) => {
      const flow = buildFlow(next);
      setNodes(flow.nodes);
      setEdges(flow.edges);
    },
    [setNodes, setEdges],
  );

  const refresh = useCallback(async () => {
    try {
      const next = await getOrgGraph(orgId);
      setGraph(next);
      applyGraph(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load organization graph");
    } finally {
      setLoading(false);
    }
    try {
      setReadiness(await getReadiness(orgId));
    } catch {
      // readiness is best-effort
    }
  }, [orgId, applyGraph]);

  useEffect(() => {
    let cancelled = false;
    getOrgGraph(orgId)
      .then((next) => {
        if (cancelled) return;
        setGraph(next);
        applyGraph(next);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load organization graph",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    getReadiness(orgId)
      .then((report) => {
        if (!cancelled) setReadiness(report);
      })
      .catch(() => {
        // readiness is best-effort
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, applyGraph]);

  const sourceById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const selectedOrg = selectedId ? (sourceById.get(selectedId) ?? null) : null;

  const parentOf = useMemo(() => buildParentMap(nodes), [nodes]);

  const isDescendant = useCallback(
    (ancestorId: string, id: string) => {
      let cursor: string | null = parentOf.get(id) ?? null;
      while (cursor) {
        if (cursor === ancestorId) return true;
        cursor = parentOf.get(cursor) ?? null;
      }
      return false;
    },
    [parentOf],
  );

  const depthOf = useCallback(
    (id: string) => {
      let depth = 0;
      let cursor: string | null = parentOf.get(id) ?? null;
      while (cursor) {
        depth += 1;
        cursor = parentOf.get(cursor) ?? null;
      }
      return depth;
    },
    [parentOf],
  );

  const handleDragStop: OnNodeDrag<OrgFlowNode> = useCallback(
    (_event, node) => {
      const rect = {
        x: node.position.x,
        y: node.position.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
      const candidates = getIntersectingNodes(rect, true).filter((candidate) => {
        if (candidate.id === node.id) return false;
        if (isDescendant(node.id, candidate.id)) return false;
        return candidate.data.kind === "team" || candidate.data.kind === "dream";
      });
      if (candidates.length === 0) return;
      const target = candidates.reduce((best, candidate) =>
        depthOf(candidate.id) > depthOf(best.id) ? candidate : best,
      );
      const currentParent = node.data.parentId ?? null;
      if (target.id !== currentParent) {
        setProposal({
          nodeId: node.id,
          nodeLabel: node.data.label,
          newParentId: target.id,
          newParentLabel: target.data.label,
        });
      }
    },
    [getIntersectingNodes, isDescendant, depthOf],
  );

  const removeParentEdge = async (nodeId: string, newParentId: string) => {
    const currentParent = deriveParentId(graph).get(nodeId) ?? null;
    if (!currentParent || currentParent === newParentId) return;
    const existing = graph.edges.find(
      (edge) =>
        edge.toNodeId === nodeId &&
        edge.fromNodeId === currentParent &&
        PARENT_RELATIONS.includes(edge.relation),
    );
    if (existing) await deleteOrgEdge(orgId, existing.id);
  };

  const confirmProposal = useCallback(async () => {
    if (!proposal) return;
    const targetNode = sourceById.get(proposal.newParentId);
    const relation: OrgEdgeRelation =
      targetNode?.kind === "team" ? "member_of" : "depends_on";
    try {
      await removeParentEdge(proposal.nodeId, proposal.newParentId);
      await createOrgEdge(orgId, {
        fromNodeId: proposal.nodeId,
        toNodeId: proposal.newParentId,
        relation,
      });
    } finally {
      setProposal(null);
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal, sourceById, graph, orgId, refresh]);

  const cancelProposal = useCallback(() => setProposal(null), []);

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    setConnectPick({ source: connection.source, target: connection.target });
  }, []);

  const confirmRelation = useCallback(
    async (relation: OrgEdgeRelation) => {
      if (!connectPick) return;
      try {
        await createOrgEdge(orgId, {
          fromNodeId: connectPick.source,
          toNodeId: connectPick.target,
          relation,
        });
      } finally {
        setConnectPick(null);
        void refresh();
      }
    },
    [connectPick, orgId, refresh],
  );

  const cancelRelation = useCallback(() => setConnectPick(null), []);

  const showContextMenu = useCallback(
    (event: { clientX: number; clientY: number; preventDefault: () => void }, nodeId: string | null) => {
      event.preventDefault();
      const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({ x: flowPosition.x, y: flowPosition.y, nodeId });
    },
    [screenToFlowPosition],
  );

  const handleContextAction = useCallback(
    async (action: ContextAction) => {
      const menu = contextMenu;
      if (!menu) return;
      const position = { x: menu.x, y: menu.y };
      try {
        switch (action.type) {
          case "agent":
          case "team":
          case "heartbeat":
          case "tool":
          case "internal-app": {
            const name =
              action.type === "agent"
                ? "New Agent"
                : action.type === "team"
                  ? "New Team"
                  : action.type === "heartbeat"
                    ? "New Heartbeat"
                    : action.type === "internal-app"
                      ? "Internal App"
                      : "New Tool";
            const node = await createOrgNode(orgId, {
              kind: action.kind,
              name,
              position,
            });
            if (menu.nodeId) {
              const relation: OrgEdgeRelation =
                action.kind === "tool" ? "uses" : "member_of";
              await createOrgEdge(orgId, {
                fromNodeId: node.id,
                toNodeId: menu.nodeId,
                relation,
              }).catch(() => undefined);
            }
            setSelectedId(node.id);
            void refresh();
            break;
          }
          case "human": {
            const email = window.prompt("Email of the human to add:");
            if (!email) break;
            const member = await addOrganizationMember(orgId, {
              email,
              role: "member",
            });
            const node = await createOrgNode(orgId, {
              kind: "human",
              name: member.displayName || email,
              refId: member.actorId ?? null,
              config: { title: member.title ?? "" },
              position,
            });
            if (menu.nodeId) {
              await createOrgEdge(orgId, {
                fromNodeId: node.id,
                toNodeId: menu.nodeId,
                relation: "member_of",
              }).catch(() => undefined);
            }
            setSelectedId(node.id);
            void refresh();
            break;
          }
          case "connect": {
            setConnectExistingFrom(menu.nodeId);
            break;
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setContextMenu(null);
      }
    },
    [contextMenu, orgId, refresh],
  );

  const connectExistingTargets = useMemo(
    () => graph.nodes.filter((node) => node.id !== connectExistingFrom),
    [graph.nodes, connectExistingFrom],
  );

  const pickConnectTarget = useCallback(
    (targetId: string) => {
      if (!connectExistingFrom) return;
      setConnectPick({ source: connectExistingFrom, target: targetId });
      setConnectExistingFrom(null);
    },
    [connectExistingFrom],
  );

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Building the canvas…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center text-sm text-muted-foreground">
          <Network className="size-5 text-muted-foreground" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow<OrgFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => setSelectedId(node.id)}
        onNodeDragStop={handleDragStop}
        onNodeContextMenu={(event, node) => showContextMenu(event, node.id)}
        onPaneContextMenu={(event) => showContextMenu(event, null)}
        onConnect={handleConnect}
        nodesConnectable
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.35}
        maxZoom={1.75}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <Controls />
        <MiniMap
          nodeColor={(node) => MINIMAP_COLORS[(node.data as OrgNodeData).kind]}
          nodeStrokeColor="var(--border)"
          bgColor="var(--card)"
          maskColor="var(--background)"
        />
        <Legend />
        <Panel position="bottom-left">
          <ReadinessPanel report={readiness} loading={loading} />
        </Panel>
      </ReactFlow>

      <AnimatePresence>
        {selectedOrg ? (
          <NodeDrawer key={selectedOrg.id} node={selectedOrg} onClose={() => setSelectedId(null)} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {proposal ? (
          <ChangeProposal
            key="proposal"
            proposal={proposal}
            onConfirm={confirmProposal}
            onCancel={cancelProposal}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {connectPick ? (
          <RelationPicker
            key="relation"
            source={connectPick.source}
            target={connectPick.target}
            nodes={graph.nodes}
            onConfirm={confirmRelation}
            onCancel={cancelRelation}
          />
        ) : null}
      </AnimatePresence>

      {connectExistingFrom ? (
        <ConnectExistingModal
          nodes={connectExistingTargets}
          onPick={pickConnectTarget}
          onClose={() => setConnectExistingFrom(null)}
        />
      ) : null}

      <AnimatePresence>
        {contextMenu ? (
          <ContextMenu
            key="context"
            state={contextMenu}
            onSelect={(action) => void handleContextAction(action)}
            onClose={() => setContextMenu(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ConnectExistingModal({
  nodes,
  onPick,
  onClose,
}: {
  nodes: OrgNode[];
  onPick: (nodeId: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        className="absolute inset-0 z-20 bg-black/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
        <motion.div
          className="flex max-h-[70vh] w-full max-w-sm flex-col rounded-xl border border-border bg-card p-5 shadow-lg"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ type: "tween", duration: 0.15 }}
        >
          <div className="flex items-center gap-2">
            <GitMerge className="size-5 text-space-accent" />
            <h2 className="font-display text-base font-semibold">Connect to existing</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose a node to connect the source to, then pick a relation.
          </p>
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {nodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other nodes yet.</p>
            ) : (
              nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => onPick(node.id)}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: MINIMAP_COLORS[node.kind] }}
                  />
                  <span className="truncate font-medium">{node.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {KIND_LABEL[node.kind]}
                  </span>
                </button>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}