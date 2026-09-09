import { z } from "zod";
import { EntityBase, Id } from "./common.js";

/** Replaceable runtime harness. */
export const HarnessKind = z.enum([
  "hermes",
  "openclaw",
  "openmanus",
  "opencode",
  "codex",
  "generic_http",
  "mcp",
]);
export type HarnessKind = z.infer<typeof HarnessKind>;

export const Harness = z.object({
  kind: HarnessKind,
  /** MCP endpoint URL or generic HTTP endpoint for the harness. */
  endpoint: z.string().url().nullable(),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type Harness = z.infer<typeof Harness>;

export const AutonomyLevel = z.enum(["suggest", "approve", "autonomous"]);
export type AutonomyLevel = z.infer<typeof AutonomyLevel>;

/** Per-action execution permission for an Agent. */
export const ActionPermission = z.enum(["automatic", "approval", "never"]);
export type ActionPermission = z.infer<typeof ActionPermission>;

/** Deterministic scheduled task attached to an Agent. */
export const AgentSchedule = z.object({
  id: Id,
  enabled: z.boolean().default(true),
  cron: z.string().min(1),
  prompt: z.string().min(1),
});
export type AgentSchedule = z.infer<typeof AgentSchedule>;

/**
 * Heartbeat / proactive-mode configuration. `cron` uses a standard 5-field
 * schedule; `quietHours` is `"HH:MM-HH:MM"`. `check` lists the scopes the
 * agent may inspect on each wake-up; `onAction` decides what happens when it
 * finds something that requires attention.
 */
export const Heartbeat = z
  .object({
    enabled: z.boolean().default(false),
    cron: z.string().nullable(),
    quietHours: z.string().nullable(),
    check: z.array(z.string()).default([]),
    onAction: z.enum(["act", "ask", "notify"]).default("ask"),
  })
  .default({ enabled: false, cron: null, quietHours: null, check: [], onAction: "ask" });
export type Heartbeat = z.infer<typeof Heartbeat>;

/** An Agent is an Actor, not merely a runtime. */
export const Agent = EntityBase.extend({
  actorId: Id,
  ownerId: Id,
  organizationIds: z.array(Id).default([]),
  role: z.string().nullable(),
  /** One-sentence "what should it help with?". */
  purpose: z.string().nullable(),
  description: z.string().nullable(),
  harness: Harness,
  skillIds: z.array(Id).default([]),
  capabilityIds: z.array(Id).default([]),
  /** Connector access grants (Connection != Permission). */
  connectorIds: z.array(Id).default([]),
  permissions: z.array(Id).default([]),
  autonomy: AutonomyLevel.default("approve"),
  budget: z.number().min(0).nullable(),
  heartbeat: Heartbeat,
  /** Allowed memory scopes (e.g. organization, department, customer…). */
  memoryScopes: z.array(z.string()).default([]),
  /** Event types the agent subscribes to. */
  subscribedEvents: z.array(z.string()).default([]),
  /** Deterministic scheduled tasks (separate from heartbeat). */
  schedules: z.array(AgentSchedule).default([]),
  /** Per-action permission levels keyed by action id. */
  actionPermissions: z.record(z.string(), ActionPermission).default({}),
  availability: z.enum(["available", "busy", "offline"]).default("offline"),
  /** Advanced: system instructions surfaced only in Advanced settings. */
  systemPrompt: z.string().nullable(),
  /**
   * Per-agent model assignment, encoded as `providerId::modelId` referencing an
   * enabled model on a configured provider. `null` means "use the first enabled
   * model" (the platform default).
   */
  model: z.string().nullable(),
  performance: z.record(z.string(), z.number()).default({}),
});
export type Agent = z.infer<typeof Agent>;

/** Partial update body for `PATCH /agents/:id`. All fields optional. */
export const UpdateAgentBody = z
  .object({
    role: z.string().nullable().optional(),
    purpose: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    organizationIds: z.array(Id).optional(),
    skillIds: z.array(Id).optional(),
    capabilityIds: z.array(Id).optional(),
    connectorIds: z.array(Id).optional(),
    permissions: z.array(Id).optional(),
    autonomy: AutonomyLevel.optional(),
    budget: z.number().min(0).nullable().optional(),
    heartbeat: Heartbeat.optional(),
    memoryScopes: z.array(z.string()).optional(),
    subscribedEvents: z.array(z.string()).optional(),
    schedules: z.array(AgentSchedule).optional(),
    actionPermissions: z.record(z.string(), ActionPermission).optional(),
    availability: z.enum(["available", "busy", "offline"]).optional(),
    systemPrompt: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
  })
  .strict();
export type UpdateAgentBody = z.infer<typeof UpdateAgentBody>;