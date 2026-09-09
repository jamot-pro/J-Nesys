"use client";

import { useMemo } from "react";
import { z } from "zod";
import { useAgentContext, useFrontendTool } from "@copilotkit/react-core/v2";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { useAuth } from "@/components/auth/auth-context";
import {
  OrgNode,
  OrgNodeKind,
  createAgent,
  createOrgEdge,
  createOrgNode,
  getOrgGraph,
  updateDreamConfig,
} from "@/lib/api-client";

const RELATION_VALUES = [
  "requires",
  "owns",
  "member_of",
  "responsible_for",
  "uses",
  "has_access_to",
  "monitors",
  "invokes",
  "depends_on",
] as const;

/**
 * DREAM configuration tools exposed to the "dream" (Vibe DREAM Configurator)
 * agent. These let the agent PERFORM configuration actions on the org graph
 * (create teams/heartbeats/responsibilities/tools, connect them, assign
 * responsibilities, move members into teams) rather than merely answering
 * questions. Everything runs through the same org-graph API the canvas uses.
 */
export function DreamToolBridge() {
  const { space } = useAppShell();
  const { user } = useAuth();
  const orgId = space.kind === "organization" ? (space.organizationId ?? null) : null;

  const orgContext = useMemo(
    () => ({
      spaceId: space.spaceId ?? null,
      organizationId: orgId,
      workspaceId: space.workspaceId ?? null,
      spaceName: space.name,
      kind: space.kind ?? "personal",
    }),
    [space.spaceId, orgId, space.workspaceId, space.name, space.kind],
  );
  useAgentContext({
    description: "active Jamot organization whose DREAM and org graph the agent configures",
    value: orgContext,
  });

  const graphTools = useMemo(
    () => ({
      requireOrg: (): string => {
        if (!orgId) throw new Error("No active organization selected.");
        return orgId;
      },
      findNode: (nodes: OrgNode[], name: string, kind?: OrgNodeKind): OrgNode => {
        const q = name.trim().toLowerCase();
        const match =
          nodes.find((n) => n.name.toLowerCase() === q && (!kind || n.kind === kind)) ??
          nodes.find((n) => n.name.toLowerCase().includes(q) && (!kind || n.kind === kind));
        if (!match) throw new Error(`No ${kind ?? "node"} found matching "${name}".`);
        return match;
      },
    }),
    [orgId],
  );

  useFrontendTool(
    {
      name: "configureDream",
      description:
        "Configure the DREAM of the active organization: set its objective, measurable outcomes, KPIs, constraints, timeline, required capabilities and required responsibilities. Call after gathering these from the user.",
      parameters: z.object({
        objective: z.string().describe("The DREAM objective, e.g. a €1M ARR AI consulting company"),
        outcomes: z.array(z.string()).optional(),
        kpis: z
          .array(z.object({ name: z.string(), target: z.string(), unit: z.string().optional() }))
          .optional(),
        constraints: z.array(z.string()).optional(),
        timeline: z
          .array(z.object({ milestone: z.string(), by: z.string() }))
          .optional(),
        requiredCapabilities: z.array(z.string()).optional(),
        requiredResponsibilities: z.array(z.string()).optional(),
      }),
      handler: async (args) => {
        const id = graphTools.requireOrg();
        const res = await updateDreamConfig(id, {
          objective: args.objective,
          outcomes: args.outcomes ?? [],
          kpis: (args.kpis ?? []).map((k) => ({ name: k.name, target: k.target, unit: k.unit ?? "" })),
          constraints: args.constraints ?? [],
          timeline: args.timeline ?? [],
          requiredCapabilities: args.requiredCapabilities ?? [],
          requiredResponsibilities: args.requiredResponsibilities ?? [],
        });
        return { dream: res.dream, nodeId: res.node.id };
      },
    },
    [graphTools],
  );

  useFrontendTool(
    {
      name: "createTeam",
      description:
        "Create a Team node in the org graph. Teams are first-class entities that own responsibilities and contain humans and agents.",
      parameters: z.object({
        name: z.string().describe("The team's name"),
        mission: z.string().optional().describe("The team's mission/purpose"),
      }),
      handler: async ({ name, mission }) => {
        const id = graphTools.requireOrg();
        const node = await createOrgNode(id, {
          kind: "team",
          name,
          config: mission ? { mission } : {},
          position: { x: 120 + Math.random() * 200, y: 120 + Math.random() * 200 },
        });
        return { id: node.id, kind: node.kind, name: node.name };
      },
    },
    [graphTools],
  );

  useFrontendTool(
    {
      name: "createResponsibility",
      description:
        "Create a Responsibility node. Every important responsibility must have an owner (human, agent, or team).",
      parameters: z.object({
        name: z.string().describe("The responsibility's name, e.g. Sales, Finance"),
        ownerKind: z
          .enum(["human", "agent", "team"])
          .optional()
          .describe("Preferred owner kind if assigning immediately"),
      }),
      handler: async ({ name, ownerKind }) => {
        const id = graphTools.requireOrg();
        const node = await createOrgNode(id, {
          kind: "responsibility",
          name,
          position: { x: 120 + Math.random() * 200, y: 120 + Math.random() * 200 },
        });
        return { id: node.id, kind: node.kind, name: node.name, ownerKind: ownerKind ?? null };
      },
    },
    [graphTools],
  );

  useFrontendTool(
    {
      name: "createHeartbeat",
      description:
        "Create a Heartbeat node — a recurring Monitor→Evaluate→Act→Verify mechanism that keeps the organization alive.",
      parameters: z.object({
        name: z.string().describe("The heartbeat's name, e.g. Weekly pulse"),
        schedule: z.string().optional().describe("Cron schedule (default: 0 9 * * 1)"),
        monitors: z.array(z.string()).optional(),
        actions: z.array(z.string()).optional().describe("Actions; include 'escalate' for escalation"),
      }),
      handler: async ({ name, schedule, monitors, actions }) => {
        const id = graphTools.requireOrg();
        const node = await createOrgNode(id, {
          kind: "heartbeat",
          name,
          config: {
            schedule: schedule ?? "0 9 * * 1",
            monitors: monitors ?? [],
            actions: actions ?? ["reflect"],
            enabled: true,
          },
          position: { x: 120 + Math.random() * 200, y: 120 + Math.random() * 200 },
        });
        return { id: node.id, kind: node.kind, name: node.name };
      },
    },
    [graphTools],
  );

  useFrontendTool(
    {
      name: "addTool",
      description:
        "Add a Tool node (MCP server, API, SaaS, internal app, database, workflow). Tools are capabilities, not actors.",
      parameters: z.object({
        name: z.string().describe("The tool's name, e.g. CRM"),
        provider: z.string().optional().describe("Provider type, e.g. mcp, api, internal, saas"),
      }),
      handler: async ({ name, provider }) => {
        const id = graphTools.requireOrg();
        const node = await createOrgNode(id, {
          kind: "tool",
          name,
          config: { provider: provider ?? "mcp" },
          position: { x: 120 + Math.random() * 200, y: 120 + Math.random() * 200 },
        });
        return { id: node.id, kind: node.kind, name: node.name };
      },
    },
    [graphTools],
  );

  useFrontendTool(
    {
      name: "connectNodes",
      description:
        "Connect two existing org-graph nodes with a typed relationship (e.g. agent uses tool, heartbeat monitors team, team owns responsibility). Identify both nodes by name and the relation.",
      parameters: z.object({
        fromName: z.string().describe("Name of the source node"),
        toName: z.string().describe("Name of the target node"),
        relation: z.enum(RELATION_VALUES).describe("The relationship"),
      }),
      handler: async ({ fromName, toName, relation }) => {
        const id = graphTools.requireOrg();
        const graph = await getOrgGraph(id);
        const from = graphTools.findNode(graph.nodes, fromName);
        const to = graphTools.findNode(graph.nodes, toName);
        const edge = await createOrgEdge(id, {
          fromNodeId: from.id,
          toNodeId: to.id,
          relation,
        });
        return {
          edgeId: edge.id,
          relation: edge.relation,
          from: from.name,
          to: to.name,
        };
      },
    },
    [graphTools],
  );

  useFrontendTool(
    {
      name: "assignResponsibility",
      description:
        "Assign a responsibility to an owner (human, agent, or team) by creating a responsible_for/owns edge. Use to cover uncovered responsibilities.",
      parameters: z.object({
        responsibilityName: z.string().describe("The responsibility's name"),
        ownerName: z.string().describe("Name of the owner (human, agent, or team)"),
      }),
      handler: async ({ responsibilityName, ownerName }) => {
        const id = graphTools.requireOrg();
        const graph = await getOrgGraph(id);
        const resp = graphTools.findNode(graph.nodes, responsibilityName, "responsibility");
        const owner = graphTools.findNode(graph.nodes, ownerName);
        const relation: (typeof RELATION_VALUES)[number] =
          owner.kind === "team" ? "owns" : "responsible_for";
        const edge = await createOrgEdge(id, {
          fromNodeId: owner.id,
          toNodeId: resp.id,
          relation,
        });
        return { edgeId: edge.id, owner: owner.name, responsibility: resp.name };
      },
    },
    [graphTools],
  );

  useFrontendTool(
    {
      name: "moveMemberToTeam",
      description:
        "Move a human or agent into a team by creating a member_of edge. Humans/Agents become members of teams; teams are members of the DREAM.",
      parameters: z.object({
        memberName: z.string().describe("Name of the human or agent"),
        teamName: z.string().describe("Name of the team"),
      }),
      handler: async ({ memberName, teamName }) => {
        const id = graphTools.requireOrg();
        const graph = await getOrgGraph(id);
        const member = graphTools.findNode(graph.nodes, memberName);
        const team = graphTools.findNode(graph.nodes, teamName, "team");
        const edge = await createOrgEdge(id, {
          fromNodeId: member.id,
          toNodeId: team.id,
          relation: "member_of",
        });
        return { edgeId: edge.id, member: member.name, team: team.name };
      },
    },
    [graphTools],
  );

  useFrontendTool(
    {
      name: "createAgent",
      description:
        "Create a new Agent (an AI/software actor) and add it to the org graph, optionally in a team. Ask for name, role, and autonomy before calling.",
      parameters: z.object({
        name: z.string().describe("The agent's name"),
        role: z.string().optional().describe("Role/purpose"),
        autonomy: z.enum(["suggest", "approve", "autonomous"]).optional(),
        teamName: z.string().optional().describe("Team to place the agent in"),
      }),
      handler: async ({ name, role, autonomy, teamName }) => {
        const id = graphTools.requireOrg();
        const ownerId = user?.actor?.id;
        if (!ownerId) throw new Error("You must be signed in to create an agent.");
        const created = await createAgent({
          name,
          ownerId,
          role: role ?? null,
          organizationIds: [id],
          autonomy,
        });
        const node = await createOrgNode(id, {
          kind: "agent",
          name,
          refId: created.id,
          config: { autonomy: autonomy ?? "suggest" },
          position: { x: 120 + Math.random() * 200, y: 120 + Math.random() * 200 },
        });
        if (teamName) {
          const graph = await getOrgGraph(id);
          const team = graphTools.findNode(graph.nodes, teamName, "team");
          await createOrgEdge(id, { fromNodeId: node.id, toNodeId: team.id, relation: "member_of" });
        }
        return { id: created.id, name: created.role ?? created.purpose ?? name };
      },
    },
    [graphTools, user?.actor?.id],
  );

  return null;
}