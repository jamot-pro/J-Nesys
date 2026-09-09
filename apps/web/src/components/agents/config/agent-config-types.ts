import type {
  AgentActionPermission,
  AgentAutonomy,
  ApiAgent,
  ApiAgentSchedule,
  ApiAgentHeartbeat,
  UpdateAgentBody,
} from "@/lib/api-client";

export const RELATIONSHIP_KINDS = [
  "reports_to",
  "manages",
  "collaborates_with",
  "delegates_to",
  "receives_tasks_from",
  "supports",
] as const;

export const MEMORY_SCOPE_OPTIONS = [
  "person",
  "agent",
  "relationship",
  "organization",
  "department",
  "customer",
] as const;

export const HEARTBEAT_CHECK_OPTIONS = [
  "assigned_tasks",
  "new_messages",
  "mentions",
  "deadlines",
  "inbox",
  "reports",
] as const;

export const ACTION_OPTIONS = [
  "send_message",
  "schedule_meeting",
  "create_task",
  "assign_task",
  "send_email",
  "update_crm",
  "create_invoice",
  "spend_money",
  "delete_records",
  "modify_settings",
  "publish_content",
] as const;

export const KNOWN_EVENT_TYPES = [
  "actor.created",
  "actor.updated",
  "agent.created",
  "agent.updated",
  "agent.disabled",
  "agent.deleted",
  "relationship.created",
  "relationship.deleted",
  "organization.created",
  "member.joined",
  "member.left",
  "conversation.created",
  "message.received",
  "message.sent",
  "task.created",
  "task.assigned",
  "task.started",
  "task.completed",
  "decision.proposed",
  "decision.approved",
  "decision.rejected",
  "skill.created",
  "skill.updated",
  "capability.granted",
  "capability.revoked",
  "memory.created",
  "memory.updated",
  "knowledge.created",
  "knowledge.invalidated",
  "reputation.updated",
  "treasury.contribution",
  "treasury.proposal",
  "treasury.payment",
  "blueprint.proposed",
  "blueprint.approved",
  "blueprint.changed",
  "lead.created",
  "invoice.overdue",
  "supplier.updated",
  "project.updated",
  "calendar.approaching",
] as const;

export interface AgentConfigState {
  role: string;
  purpose: string;
  description: string;
  autonomy: AgentAutonomy;
  availability: ApiAgent["availability"];
  organizationIds: string[];
  skillIds: string[];
  capabilityIds: string[];
  connectorIds: string[];
  memoryScopes: string[];
  subscribedEvents: string[];
  schedules: ApiAgentSchedule[];
  actionPermissions: Record<string, AgentActionPermission>;
  heartbeat: ApiAgentHeartbeat;
  budget: string;
  systemPrompt: string;
  model: string | null;
}

export function emptyHeartbeat(): ApiAgentHeartbeat {
  return {
    enabled: false,
    cron: null,
    quietHours: null,
    check: [],
    onAction: "ask",
  };
}

export function stateFromAgent(agent: ApiAgent): AgentConfigState {
  return {
    role: agent.role ?? "",
    purpose: agent.purpose ?? "",
    description: agent.description ?? "",
    autonomy: agent.autonomy,
    availability: agent.availability,
    organizationIds: [...agent.organizationIds],
    skillIds: [...agent.skillIds],
    capabilityIds: [...agent.capabilityIds],
    connectorIds: [...agent.connectorIds],
    memoryScopes: [...agent.memoryScopes],
    subscribedEvents: [...agent.subscribedEvents],
    schedules: agent.schedules.map((schedule) => ({ ...schedule })),
    actionPermissions: { ...agent.actionPermissions },
    heartbeat: { ...agent.heartbeat },
    budget: agent.budget === null ? "" : String(agent.budget),
    systemPrompt: agent.systemPrompt ?? "",
    model: agent.model ?? null,
  };
}

export function buildUpdateBody(
  agent: ApiAgent,
  state: AgentConfigState,
): UpdateAgentBody {
  const body: UpdateAgentBody = {};
  if (state.role.trim() !== (agent.role ?? "")) body.role = state.role.trim() || null;
  if (state.purpose.trim() !== (agent.purpose ?? ""))
    body.purpose = state.purpose.trim() || null;
  if (state.description.trim() !== (agent.description ?? ""))
    body.description = state.description.trim() || null;
  if (state.autonomy !== agent.autonomy) body.autonomy = state.autonomy;
  if (state.availability !== agent.availability) body.availability = state.availability;
  if (!sameIds(state.organizationIds, agent.organizationIds))
    body.organizationIds = state.organizationIds;
  if (!sameIds(state.skillIds, agent.skillIds)) body.skillIds = state.skillIds;
  if (!sameIds(state.capabilityIds, agent.capabilityIds))
    body.capabilityIds = state.capabilityIds;
  if (!sameIds(state.connectorIds, agent.connectorIds))
    body.connectorIds = state.connectorIds;
  if (!sameStrings(state.memoryScopes, agent.memoryScopes))
    body.memoryScopes = state.memoryScopes;
  if (!sameStrings(state.subscribedEvents, agent.subscribedEvents))
    body.subscribedEvents = state.subscribedEvents;
  if (!sameSchedules(state.schedules, agent.schedules)) body.schedules = state.schedules;
  if (!samePermissions(state.actionPermissions, agent.actionPermissions))
    body.actionPermissions = state.actionPermissions;
  if (!sameHeartbeat(state.heartbeat, agent.heartbeat)) body.heartbeat = state.heartbeat;
  const budget = state.budget.trim() === "" ? null : Number(state.budget);
  if ((agent.budget ?? null) !== budget) body.budget = budget;
  if (state.systemPrompt !== (agent.systemPrompt ?? ""))
    body.systemPrompt = state.systemPrompt.trim() || null;
  if (state.model !== agent.model) body.model = state.model;
  return body;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameStrings(a: string[], b: string[]): boolean {
  return sameIds(a, b);
}

function sameSchedules(a: ApiAgentSchedule[], b: ApiAgentSchedule[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((schedule, index) => {
    const other = b[index];
    if (!other) return false;
    return (
      schedule.id === other.id &&
      schedule.enabled === other.enabled &&
      schedule.cron === other.cron &&
      schedule.prompt === other.prompt
    );
  });
}

function samePermissions(
  a: Record<string, AgentActionPermission>,
  b: Record<string, AgentActionPermission>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function sameHeartbeat(a: ApiAgentHeartbeat, b: ApiAgentHeartbeat): boolean {
  return (
    a.enabled === b.enabled &&
    a.cron === b.cron &&
    a.quietHours === b.quietHours &&
    a.onAction === b.onAction &&
    sameIds(a.check, b.check)
  );
}

export interface ReadinessItem {
  label: string;
  met: boolean;
  detail?: string;
}

export function computeReadiness(state: AgentConfigState): ReadinessItem[] {
  return [
    {
      label: "Role",
      met: state.role.trim() !== "",
      detail: state.role.trim() || "Give the agent a clear job title.",
    },
    {
      label: "Purpose",
      met: state.purpose.trim() !== "",
      detail:
        state.purpose.trim() ||
        "One sentence describing what the agent should help with.",
    },
    {
      label: "Skills",
      met: state.skillIds.length > 0,
      detail:
        state.skillIds.length > 0
          ? `${state.skillIds.length} assigned`
          : "Attach at least one skill.",
    },
    {
      label: "Connections",
      met: state.connectorIds.length > 0,
      detail:
        state.connectorIds.length > 0
          ? `${state.connectorIds.length} connected`
          : "Connect at least one tool. Connection is separate from permission.",
    },
    {
      label: "Action permissions",
      met: Object.keys(state.actionPermissions).length > 0,
      detail:
        Object.keys(state.actionPermissions).length > 0
          ? `${Object.keys(state.actionPermissions).length} actions configured`
          : "Decide how the agent may act on each action.",
    },
    {
      label: "Memory access",
      met: state.memoryScopes.length > 0,
      detail:
        state.memoryScopes.length > 0
          ? `${state.memoryScopes.length} scopes allowed`
          : "Allow at least one memory scope.",
    },
    {
      label: "Working rhythm",
      met: state.heartbeat.enabled || state.schedules.length > 0,
      detail:
        state.heartbeat.enabled || state.schedules.length > 0
          ? "Heartbeat or scheduled tasks configured"
          : "Enable a heartbeat or add a scheduled task.",
    },
  ];
}

export function isCronValid(cron: string): boolean {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field) => /^(\d+|\*|\*\/\d+|\d+-\d+|\d+,\d+)$/.test(field));
}

export function isQuietHoursValid(value: string): boolean {
  return /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value);
}

export function newScheduleId(): string {
  return crypto.randomUUID();
}