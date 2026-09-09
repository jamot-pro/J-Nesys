import type {
  OrgGraph,
  OrgNode,
  OrgNodeKind,
} from "@jamot/contracts";
import type { MemoryProvider } from "@jamot/core/memory";
import { cronMatches } from "../scheduler/cron.js";

/**
 * Org-graph Heartbeats are first-class nodes that keep the organization alive:
 * Monitor → Evaluate → Act → Verify. This module executes them and records
 * what happened as organizational memory events so history is preserved.
 */

export interface OrgHeartbeatEvaluation {
  /** Names of nodes this heartbeat monitors (via `monitors` edges). */
  monitors: string[];
  /** Detected gaps — monitored teams/dreams with no active human/agent members. */
  gaps: string[];
}

/** A heartbeat is due when enabled and its cron schedule matches `now`. */
export function isOrgHeartbeatDue(node: OrgNode, now: Date): boolean {
  const schedule = node.config?.schedule;
  if (node.config?.enabled === false) return false;
  if (typeof schedule !== "string" || schedule.length === 0) return false;
  return cronMatches(schedule, now);
}

function monitoredNodeIds(graph: OrgGraph, heartbeatId: string): Set<string> {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.relation === "monitors" && edge.fromNodeId === heartbeatId) {
      ids.add(edge.toNodeId);
    }
  }
  return ids;
}

function memberIdsInto(graph: OrgGraph, nodeId: string): Set<string> {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.relation === "member_of" && edge.toNodeId === nodeId) {
      ids.add(edge.fromNodeId);
    }
  }
  return ids;
}

const MONITORABLE_KINDS: OrgNodeKind[] = ["team", "dream"];

/** Evaluate one heartbeat against the graph: what it monitors and any gaps. */
export function evaluateOrgHeartbeat(
  graph: OrgGraph,
  node: OrgNode,
): OrgHeartbeatEvaluation {
  const nodesById = new Map<string, OrgNode>(
    graph.nodes.map((n) => [n.id as unknown as string, n]),
  );
  const monitors: string[] = [];
  const gaps: string[] = [];

  for (const id of monitoredNodeIds(graph, node.id)) {
    const target = nodesById.get(id);
    if (!target) continue;
    monitors.push(target.name);
    if (!MONITORABLE_KINDS.includes(target.kind)) continue;

    // Inactivity / disengagement gap: a team or dream with no human/agent members.
    const members = memberIdsInto(graph, id);
    const hasActorMember = [...members].some((memberId) => {
      const member = nodesById.get(memberId);
      return member && (member.kind === "human" || member.kind === "agent");
    });
    if (!hasActorMember) {
      gaps.push(`${target.name} (${target.kind}) has no human/agent members`);
    }
  }

  return { monitors, gaps };
}

export interface OrgHeartbeatRun {
  organizationId: string;
  nodeId: string;
  nodeName: string;
  monitors: string[];
  gaps: string[];
}

/**
 * Run all due heartbeats in a graph, emitting `heartbeat.fired` (and
 * `heartbeat.detected` when gaps are found) into organizational memory.
 * Returns the fired evaluations. Writes are best-effort: memory provider
 * failures are swallowed so they never break the worker loop.
 */
export async function runOrgHeartbeats(
  organizationId: string,
  graph: OrgGraph,
  memoryProvider: MemoryProvider,
  now: Date,
): Promise<OrgHeartbeatRun[]> {
  const heartbeats = graph.nodes.filter((n) => n.kind === "heartbeat");
  const runs: OrgHeartbeatRun[] = [];

  const writeMemory = (content: Record<string, unknown>): Promise<unknown> =>
    memoryProvider.store({
      scope: "organization",
      ownerId: organizationId,
      content,
      provenance: {
        source: "system",
        confidence: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    });

  for (const node of heartbeats) {
    if (!isOrgHeartbeatDue(node, now)) continue;
    const { monitors, gaps } = evaluateOrgHeartbeat(graph, node);
    const run: OrgHeartbeatRun = {
      organizationId,
      nodeId: node.id,
      nodeName: node.name,
      monitors,
      gaps,
    };
    runs.push(run);
    try {
      await writeMemory({
        type: "heartbeat.fired",
        heartbeatId: node.id,
        heartbeatName: node.name,
        monitors,
        schedule: node.config?.schedule,
      });
      if (gaps.length > 0) {
        await writeMemory({
          type: "heartbeat.detected",
          heartbeatId: node.id,
          heartbeatName: node.name,
          gaps,
        });
      }
    } catch (err) {
      console.error("[org-heartbeat] memory write failed:", err);
    }
  }

  return runs;
}