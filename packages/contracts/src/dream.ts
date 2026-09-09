import { z } from "zod";
import { EntityBase, Id, Timestamp } from "./common.js";

/**
 * Vibe DREAM Configurator — org-graph domain contracts.
 *
 * The DREAM is the central purpose of an organization. Everything else
 * (TEAMS, HUMANS, AGENTS, RESPONSIBILITIES, TOOLS, HEARTBEATS) exists to make
 * the DREAM achievable. The organization is modelled as a live graph of typed
 * nodes and typed edges, persisted by the API and projected to the memory
 * layer (knowledge graph / Graphiti) so that both current state and
 * organizational history are queryable.
 */

/** Node kinds in the organizational graph. There is no separate "bot" kind:
 *  AGENT covers every AI/software actor (bots, automations, autonomous workers). */
export const OrgNodeKind = z.enum([
  "dream",
  "team",
  "human",
  "agent",
  "responsibility",
  "tool",
  "heartbeat",
]);
export type OrgNodeKind = z.infer<typeof OrgNodeKind>;

/** Typed edges connecting org nodes. */
export const OrgEdgeRelation = z.enum([
  "requires",
  "owns",
  "member_of",
  "responsible_for",
  "uses",
  "has_access_to",
  "monitors",
  "invokes",
  "depends_on",
]);
export type OrgEdgeRelation = z.infer<typeof OrgEdgeRelation>;

/**
 * Structured DREAM configuration. The underlying DREAM orchestration skill is
 * platform-owned and hardcoded in the codebase; users configure THEIR dream,
 * never the skill.
 */
export const DreamConfig = z.object({
  /** Plain-language statement of the ultimate objective (e.g. "€1M ARR AI consulting company"). */
  objective: z.string().min(1),
  /** Measurable outcomes. */
  outcomes: z.array(z.string()).default([]),
  /** Key performance indicators. */
  kpis: z.array(
    z.object({
      name: z.string().min(1),
      target: z.string(),
      unit: z.string().default(""),
    }),
  ).default([]),
  /** Constraints (time, budget, non-goals, ...). */
  constraints: z.array(z.string()).default([]),
  /** Timeline (milestones). */
  timeline: z.array(
    z.object({
      milestone: z.string().min(1),
      by: z.string(),
    }),
  ).default([]),
  /** Required capabilities to realise the DREAM. */
  requiredCapabilities: z.array(z.string()).default([]),
  /** Required responsibilities. Each should eventually have a covered owner. */
  requiredResponsibilities: z.array(z.string()).default([]),
});
export type DreamConfig = z.infer<typeof DreamConfig>;

/** Coordinates / visual layout of a node on the canvas. */
export const OrgNodePosition = z.object({
  x: z.number(),
  y: z.number(),
});
export type OrgNodePosition = z.infer<typeof OrgNodePosition>;

/** A node in the organizational graph. */
export const OrgNode = EntityBase.extend({
  organizationId: Id,
  kind: OrgNodeKind,
  /** Display name. */
  name: z.string().min(1),
  /** Optional reference to an existing actor/entity (people, agents, skills, connectors...). */
  refId: Id.nullable().default(null),
  /** Optional structured config (e.g. DreamConfig for dream, HeartbeatConfig for heartbeat). */
  config: z.record(z.string(), z.unknown()).default({}),
  position: OrgNodePosition.default({ x: 0, y: 0 }),
});
export type OrgNode = z.infer<typeof OrgNode>;

/** A directed, typed edge in the organizational graph. */
export const OrgEdge = EntityBase.extend({
  organizationId: Id,
  fromNodeId: Id,
  toNodeId: Id,
  relation: OrgEdgeRelation,
  metadata: z.record(z.string(), z.unknown()).default({}),
  validFrom: Timestamp,
  validTo: Timestamp.nullable().default(null),
});
export type OrgEdge = z.infer<typeof OrgEdge>;

/** Full graph snapshot for canvas hydration. */
export const OrgGraph = z.object({
  nodes: z.array(OrgNode),
  edges: z.array(OrgEdge),
});
export type OrgGraph = z.infer<typeof OrgGraph>;

/** Heartbeat is a recurring Monitor → Evaluate → Act → Verify mechanism. */
export const HeartbeatConfig = z.object({
  schedule: z.string().min(1),
  /** List of monitors this heartbeat checks (free-form capability names). */
  monitors: z.array(z.string()).default([]),
  /** Action to run when the heartbeat fires (must include verify step). */
  actions: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});
export type HeartbeatConfig = z.infer<typeof HeartbeatConfig>;

/** Payload for creating a node. */
export const CreateOrgNode = z.object({
  kind: OrgNodeKind,
  name: z.string().min(1),
  refId: Id.nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  position: OrgNodePosition.optional(),
});
export type CreateOrgNode = z.infer<typeof CreateOrgNode>;

/** Payload for creating an edge. */
export const CreateOrgEdge = z.object({
  fromNodeId: Id,
  toNodeId: Id,
  relation: OrgEdgeRelation,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type CreateOrgEdge = z.infer<typeof CreateOrgEdge>;

/** Payload for setting the DREAM config. */
export const UpdateDreamConfig = DreamConfig;
export type UpdateDreamConfig = z.infer<typeof UpdateDreamConfig>;

/** A responsibility together with its current coverage status. */
export const ResponsibilityCoverage = z.object({
  responsibilityId: Id,
  name: z.string().min(1),
  /** Owner kinds: human, agent, team, or a human+agent pairing. */
  owners: z.array(OrgNodeKind),
  covered: z.boolean(),
});
export type ResponsibilityCoverage = z.infer<typeof ResponsibilityCoverage>;

/** A readiness dimension score. */
export const ReadinessDimension = z.object({
  key: z.enum([
    "dream",
    "responsibilities",
    "actors",
    "teams",
    "tools",
    "permissions",
    "dependencies",
    "heartbeats",
    "recovery",
    "escalation",
  ]),
  label: z.string(),
  score: z.number().min(0).max(1),
  /** Human-readable missing requirements to reach full coverage. */
  missing: z.array(z.string()).default([]),
});
export type ReadinessDimension = z.infer<typeof ReadinessDimension>;

/** Computed DREAM Readiness report. Readiness is NEVER hard-coded; it is
 *  derived from the actual graph configuration. */
export const ReadinessReport = z.object({
  dimensions: z.array(ReadinessDimension),
  overall: z.number().min(0).max(1),
  /** JAMOT = Just A Matter Of Time. Operational readiness: the organization is
   *  sufficiently configured to continuously pursue the DREAM, detect problems,
   *  adapt and recover. */
  jamot: z.boolean(),
  updatedAt: Timestamp,
});
export type ReadinessReport = z.infer<typeof ReadinessReport>;