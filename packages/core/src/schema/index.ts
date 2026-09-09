import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type {
  ActionPermission,
  AgentSchedule,
  Consent,
  ExternalIdentity,
  Harness,
  LeadArea,
  LeadPersona,
  PersonProfile,
  Provenance,
  SecretRef,
} from "@jamot/contracts";

export const actorTypeEnum = pgEnum("actor_type", ["human", "agent"]);
export const actorSourceEnum = pgEnum("actor_source", ["internal", "external"]);
export const actorStatusEnum = pgEnum("actor_status", [
  "active",
  "inactive",
  "suspended",
]);
export const spaceKindEnum = pgEnum("space_kind", ["personal", "organization"]);
export const roleKindEnum = pgEnum("role_kind", [
  "owner",
  "admin",
  "member",
  "agent",
  "external",
]);
export const goalStatusEnum = pgEnum("goal_status", [
  "active",
  "done",
  "archived",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "created",
  "assigned",
  "started",
  "completed",
  "cancelled",
]);
export const taskTargetTypeEnum = pgEnum("task_target_type", [
  "human",
  "agent",
  "human_agent",
  "organization",
  "external",
]);
export const skillStatusEnum = pgEnum("skill_status", [
  "draft",
  "validated",
  "deprecated",
]);
export const connectorProviderEnum = pgEnum("connector_provider", [
  "whatsapp",
  "telegram",
  "google_calendar",
  "github",
  "stripe",
  "erp",
  "database",
  "matrix",
  "discord",
  "custom",
  "composio",
  "google",
]);
export const connectorTypeEnum = pgEnum("connector_type", [
  "channel",
  "mcp",
  "harness",
  "ai_provider",
  "data",
]);
export const connectorStatusEnum = pgEnum("connector_status", [
  "connected",
  "disconnected",
  "error",
]);
export const waAccountStatusEnum = pgEnum("wa_account_status", [
  "offline",
  "pairing",
  "connecting",
  "connected",
  "error",
]);
export const autonomyEnum = pgEnum("autonomy", [
  "suggest",
  "approve",
  "autonomous",
]);
export const availabilityEnum = pgEnum("availability", [
  "available",
  "busy",
  "offline",
]);
export const policyDecisionEnum = pgEnum("policy_decision", [
  "allow",
  "deny",
  "require_human",
  "require_admin",
  "require_multisig",
]);
export const secretScopeEnum = pgEnum("secret_scope", [
  "user",
  "organization",
  "system",
  "environment",
]);

function timestamps() {
  return {
    createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}

export const actors = pgTable("actors", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: actorTypeEnum("type").notNull(),
  source: actorSourceEnum("source").notNull().default("internal"),
  displayName: text("display_name").notNull(),
  status: actorStatusEnum("status").notNull().default("active"),
  externalIdentities: jsonb("external_identities")
    .$type<ExternalIdentity[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  personalSpaceId: uuid("personal_space_id").references(
    (): AnyPgColumn => spaces.id,
  ),
  ...timestamps(),
});

export const spaces = pgTable("spaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: spaceKindEnum("kind").notNull(),
  ownerActorId: uuid("owner_actor_id")
    .notNull()
    .references((): AnyPgColumn => actors.id),
  name: text("name").notNull(),
  ...timestamps(),
});

/**
 * Per-space settings, keyed by space id. `config` is a free-form JSON bag
 * (e.g. `orchestratorModel`). One row per space; upserted on write.
 */
export const spaceSettings = pgTable("space_settings", {
  spaceId: uuid("space_id")
    .primaryKey()
    .references(() => spaces.id),
  config: jsonb("config")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...timestamps(),
});

export const people = pgTable("people", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => actors.id),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  avatarSource: text("avatar_source"),
  consent: jsonb("consent").$type<Consent>(),
  lastInteractionAt: timestamp("last_interaction_at", {
    mode: "string",
    withTimezone: true,
  }),
  profile: jsonb("profile")
    .$type<PersonProfile>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  membershipSpaceIds: uuid("membership_space_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  reputation: jsonb("reputation")
    .$type<Record<string, number>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...timestamps(),
});

/**
 * One canonical Person carries many channel identities (WhatsApp, Telegram,
 * email, Google, ...). Unique per (provider, value); provenance + confidence
 * live on the identity itself so resolution never silently merges people.
 */
export const identities = pgTable("identities", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => actors.id, { onDelete: "cascade" }),
  personId: uuid("person_id").references(() => people.id, {
    onDelete: "cascade",
  }),
  provider: text("provider").notNull(),
  value: text("value").notNull(),
  verified: boolean("verified").notNull().default(true),
  confidence: real("confidence").notNull().default(1),
  source: text("source").notNull().default("observed"),
  ...timestamps(),
});

export const modelProviders = pgTable("model_providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerActorId: uuid("owner_actor_id").references(() => actors.id, {
    onDelete: "cascade",
  }),
  ownerOrganizationId: uuid("owner_organization_id").references(
    () => organizations.id,
    { onDelete: "cascade" },
  ),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  credentialRef: text("credential_ref").notNull(),
  status: text("status").notNull().default("unknown"),
  lastTestedAt: timestamp("last_tested_at", { mode: "string", withTimezone: true }),
  lastError: text("last_error"),
  ...timestamps(),
});

export const providerModels = pgTable("provider_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => modelProviders.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  discovered: boolean("discovered").notNull().default(true),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps(),
});

/** Uncertain cross-identity matches awaiting human review (never auto-merged). */
export const personMergeCandidates = pgTable("person_merge_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id, {
    onDelete: "set null",
  }),
  personAId: uuid("person_a_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  personBId: uuid("person_b_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  detail: jsonb("detail")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  status: text("status").notNull().default("pending"),
  ...timestamps(),
});

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => actors.id),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => actors.id),
  organizationIds: uuid("organization_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  role: text("role"),
  purpose: text("purpose"),
  description: text("description"),
  harness: jsonb("harness").$type<Harness>().notNull(),
  skillIds: uuid("skill_ids").array().notNull().default(sql`'{}'::uuid[]`),
  capabilityIds: uuid("capability_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  connectorIds: uuid("connector_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  permissions: uuid("permissions")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  autonomy: autonomyEnum("autonomy").notNull().default("approve"),
  budget: numeric("budget"),
  heartbeat: jsonb("heartbeat")
    .$type<{
      enabled: boolean;
      cron: string | null;
      quietHours: string | null;
      check: string[];
      onAction: "act" | "ask" | "notify";
    }>()
    .notNull()
    .default(
      sql`'{"enabled":false,"cron":null,"quietHours":null,"check":[],"onAction":"ask"}'::jsonb`,
    ),
  memoryScopes: text("memory_scopes")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  subscribedEvents: text("subscribed_events")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  schedules: jsonb("schedules")
    .$type<AgentSchedule[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  actionPermissions: jsonb("action_permissions")
    .$type<Record<string, ActionPermission>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  availability: availabilityEnum("availability").notNull().default("offline"),
  systemPrompt: text("system_prompt"),
  model: text("model"),
  performance: jsonb("performance")
    .$type<Record<string, number>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...timestamps(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  slug: text("slug"),
  logoUrl: text("logo_url"),
  dream: text("dream").notNull().default(""),
  blueprint: jsonb("blueprint")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  enabledAppIds: text("enabled_app_ids")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  treasuryId: uuid("treasury_id"),
  reputation: jsonb("reputation")
    .$type<Record<string, number>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...timestamps(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    spaceId: uuid("space_id")
      .notNull()
      .unique()
      .references(() => spaces.id),
    name: text("name").notNull(),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps(),
  },
  (table) => [
    index("workspaces_organization_id_idx").on(table.organizationId),
  ],
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => actors.id),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    kind: roleKindEnum("kind").notNull(),
    title: text("title"),
    ...timestamps(),
  },
  (table) => [
    index("roles_actor_id_idx").on(table.actorId),
    index("roles_space_id_idx").on(table.spaceId),
  ],
);

export const relationships = pgTable(
  "relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromActorId: uuid("from_actor_id")
      .notNull()
      .references(() => actors.id, { onDelete: "cascade" }),
    toActorId: uuid("to_actor_id")
      .notNull()
      .references(() => actors.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    ...timestamps(),
  },
  (table) => [
    index("relationships_from_actor_idx").on(table.fromActorId),
    index("relationships_to_actor_idx").on(table.toActorId),
  ],
);

export const orgNodeKindEnum = pgEnum("org_node_kind", [
  "dream",
  "team",
  "human",
  "agent",
  "responsibility",
  "tool",
  "heartbeat",
]);

export const orgEdgeRelationEnum = pgEnum("org_edge_relation", [
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

export const orgNodes = pgTable(
  "org_nodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id").references(() => spaces.id),
    kind: orgNodeKindEnum("kind").notNull(),
    name: text("name").notNull(),
    /** Optional reference to an existing actor/entity (people, agents, skills, connectors...). */
    refId: uuid("ref_id"),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    positionX: real("position_x").notNull().default(0),
    positionY: real("position_y").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("org_nodes_org_idx").on(table.organizationId),
    index("org_nodes_space_idx").on(table.spaceId),
  ],
);

export const orgEdges = pgTable(
  "org_edges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id").references(() => spaces.id),
    fromNodeId: uuid("from_node_id")
      .notNull()
      .references(() => orgNodes.id, { onDelete: "cascade" }),
    toNodeId: uuid("to_node_id")
      .notNull()
      .references(() => orgNodes.id, { onDelete: "cascade" }),
    relation: orgEdgeRelationEnum("relation").notNull(),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    validFrom: timestamp("valid_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("org_edges_org_idx").on(table.organizationId),
    index("org_edges_from_idx").on(table.fromNodeId),
    index("org_edges_to_idx").on(table.toNodeId),
  ],
);

export const organicCharts = pgTable("organic_charts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  rootPositionId: uuid("root_position_id"),
  ...timestamps(),
});

export const positions = pgTable("positions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  chartId: uuid("chart_id")
    .notNull()
    .references(() => organicCharts.id),
  title: text("title").notNull(),
  parentPositionId: uuid("parent_position_id").references(
    (): AnyPgColumn => positions.id,
  ),
  holderActorId: uuid("holder_actor_id").references(() => actors.id),
  ...timestamps(),
});

export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  parentGoalId: uuid("parent_goal_id").references((): AnyPgColumn => goals.id),
  title: text("title").notNull(),
  status: goalStatusEnum("status").notNull().default("active"),
  ...timestamps(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  goalId: uuid("goal_id").references(() => goals.id),
  title: text("title").notNull(),
  ...timestamps(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    projectId: uuid("project_id").references(() => projects.id),
    listId: uuid("list_id").references(() => taskLists.id),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatusEnum("status").notNull().default("created"),
    assigneeActorIds: uuid("assignee_actor_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    targetType: taskTargetTypeEnum("target_type").notNull().default("human"),
    requiredCapabilityIds: uuid("required_capability_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    outcome: jsonb("outcome").$type<Record<string, unknown>>(),
    dueDate: timestamp("due_date", { mode: "string", withTimezone: true }),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("tasks_space_id_idx").on(table.spaceId),
    index("tasks_list_id_idx").on(table.listId),
  ],
);

export const taskLists = pgTable("task_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  ...timestamps(),
});

export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  size: integer("size").notNull().default(0),
  data: text("data").notNull(),
  ...timestamps(),
});

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerActorId: uuid("owner_actor_id").references(() => actors.id),
  ownerOrganizationId: uuid("owner_organization_id").references(
    () => organizations.id,
  ),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  body: text("body").notNull().default(""),
  version: text("version").notNull().default("1.0.0"),
  inputs: jsonb("inputs")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  outputs: jsonb("outputs")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  prerequisites: uuid("prerequisites")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  allowedCapabilityIds: uuid("allowed_capability_ids")
    .array()
    .notNull()
    .default(sql`'{}'::uuid[]`),
  evaluationCriteria: jsonb("evaluation_criteria")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  provenance: jsonb("provenance").$type<Provenance>().notNull(),
  status: skillStatusEnum("status").notNull().default("draft"),
  ...timestamps(),
});

export const connectors = pgTable("connectors", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: connectorProviderEnum("provider").notNull(),
  type: connectorTypeEnum("type").notNull().default("channel"),
  ownerActorId: uuid("owner_actor_id").references(() => actors.id),
  ownerOrganizationId: uuid("owner_organization_id").references(
    () => organizations.id,
  ),
  sharing: text("sharing").notNull().default("user"),
  capabilities: jsonb("capabilities")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  credentialRef: jsonb("credential_ref").$type<SecretRef>().notNull(),
  scopes: jsonb("scopes")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  configuration: jsonb("configuration")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  status: connectorStatusEnum("status").notNull().default("disconnected"),
  ...timestamps(),
});

export const capabilities = pgTable("capabilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  skillId: uuid("skill_id")
    .notNull()
    .references(() => skills.id),
  connectorId: uuid("connector_id")
    .notNull()
    .references(() => connectors.id),
  policyIds: uuid("policy_ids").array().notNull().default(sql`'{}'::uuid[]`),
  context: jsonb("context")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  spaceId: uuid("space_id").references(() => spaces.id),
  ...timestamps(),
});

export const policies = pgTable("policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  name: text("name").notNull(),
  capability: text("capability").notNull(),
  resource: text("resource").notNull().default("*"),
  minRole: roleKindEnum("min_role"),
  riskThreshold: numeric("risk_threshold").notNull().default("0.5"),
  decision: policyDecisionEnum("decision").notNull(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    spaceId: uuid("space_id"),
    actorId: uuid("actor_id"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    delivered: boolean("delivered").notNull().default(false),
  },
  (table) => [index("events_type_idx").on(table.type)],
);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id"),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: uuid("resource_id"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const secrets = pgTable("secrets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ref: text("ref").notNull().unique(),
  scope: secretScopeEnum("scope").notNull(),
  ownerActorId: uuid("owner_actor_id"),
  ownerOrganizationId: uuid("owner_organization_id"),
  ciphertext: text("ciphertext").notNull(),
  ...timestamps(),
});

export const composioOauthStates = pgTable(
  "composio_oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    state: text("state").notNull().unique(),
    actorId: uuid("actor_id").notNull().references(() => actors.id),
    organizationId: uuid("organization_id").references(() => organizations.id),
    sharing: text("sharing").notNull().default("user"),
    toolkit: text("toolkit").notNull(),
    composioUserId: text("composio_user_id").notNull(),
    apiKeyScope: secretScopeEnum("api_key_scope").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    consumed: boolean("consumed").notNull().default(false),
    expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true })
      .notNull(),
    ...timestamps(),
  },
  (table) => [index("composio_oauth_states_state_idx").on(table.state)],
);

export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  ...timestamps(),
});

export const waAccounts = pgTable("wa_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  label: text("label").notNull(),
  phone: text("phone"),
  status: waAccountStatusEnum("status").notNull().default("offline"),
  ...timestamps(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  channelId: uuid("channel_id").references(() => channels.id),
  title: text("title"),
  ...timestamps(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id),
  actorId: uuid("actor_id"),
  content: text("content").notNull(),
  ...timestamps(),
});

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scope: text("scope").notNull(),
    ownerId: uuid("owner_id").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    sourceEventId: uuid("source_event_id"),
    provenance: jsonb("provenance").$type<Provenance>().notNull(),
    ...timestamps(),
  },
  (table) => [
    index("memories_scope_owner_id_idx").on(table.scope, table.ownerId),
  ],
);

export const knowledgeEntities = pgTable("knowledge_entities", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  type: text("type").notNull(),
  name: text("name").notNull(),
  properties: jsonb("properties")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...timestamps(),
});

export const knowledgeEdges = pgTable(
  "knowledge_edges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spaceId: uuid("space_id").references(() => spaces.id),
    sourceId: uuid("source_id").notNull(),
    targetId: uuid("target_id").notNull(),
    relation: text("relation").notNull(),
    validFrom: timestamp("valid_from", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    validTo: timestamp("valid_to", { mode: "string", withTimezone: true }),
    provenance: jsonb("provenance").$type<Provenance>().notNull(),
    ...timestamps(),
  },
  (table) => [
    index("knowledge_edges_source_id_idx").on(table.sourceId),
    index("knowledge_edges_target_id_idx").on(table.targetId),
  ],
);

export const reputationEntries = pgTable(
  "reputation_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").notNull(),
    capability: text("capability").notNull(),
    score: numeric("score").notNull(),
    evidence: jsonb("evidence")
      .$type<{
        taskId?: string | null;
        outcome: Record<string, unknown>;
        feedback?: number | null;
        verified: boolean;
      }>()
      .notNull(),
    provenance: jsonb("provenance").$type<Provenance>().notNull(),
    ...timestamps(),
  },
  (table) => [
    index("reputation_entries_actor_capability_idx").on(
      table.actorId,
      table.capability,
    ),
  ],
);

export const treasuryAccounts = pgTable("treasury_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  currency: text("currency").notNull().default("USD"),
  balance: numeric("balance").notNull().default("0"),
});

export const treasuryLedger = pgTable("treasury_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull(),
  entryType: text("entry_type").notNull(),
  amount: numeric("amount").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const treasuryProposals = pgTable("treasury_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  amount: numeric("amount").notNull(),
  status: text("status").notNull().default("proposed"),
  proposedByActorId: uuid("proposed_by_actor_id").notNull(),
  ...timestamps(),
});

export const contributionCredits = pgTable("contribution_credits", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  capability: text("capability").notNull(),
  amount: numeric("amount").notNull(),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const distributionRules = pgTable("distribution_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  capability: text("capability").notNull(),
  share: numeric("share").notNull(),
  ...timestamps(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").notNull(),
  organizationId: uuid("organization_id"),
  onboardingStatus: text("onboarding_status").notNull().default("active"),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  terms: text("terms"),
  reputation: jsonb("reputation")
    .$type<Record<string, number>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...timestamps(),
});

export const productBase = pgTable("product_base", {
  id: uuid("id").defaultRandom().primaryKey(),
  spaceId: uuid("space_id").references(() => spaces.id),
  gtin: text("gtin"),
  sku: text("sku"),
  manufacturerId: text("manufacturer_id"),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  dimensions: jsonb("dimensions").$type<Record<string, unknown>>(),
  packaging: jsonb("packaging").$type<Record<string, unknown>>(),
  unitOfMeasure: text("unit_of_measure").notNull().default("each"),
  taxCategory: text("tax_category"),
  compliance: text("compliance").array().notNull().default(sql`'{}'::text[]`),
  lifecycle: text("lifecycle").notNull().default("draft"),
  ...timestamps(),
});

export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull(),
  spaceId: uuid("space_id").references(() => spaces.id),
  attributes: jsonb("attributes")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  ...timestamps(),
});

export const catalogs = pgTable("catalogs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerOrganizationId: uuid("owner_organization_id").notNull(),
  name: text("name").notNull(),
  version: text("version").notNull().default("1.0.0"),
  visibility: text("visibility").notNull().default("private"),
  source: text("source").notNull().default("native"),
  sourceOfTruth: text("source_of_truth").notNull().default("server"),
  syncRef: text("sync_ref"),
  lastSyncAt: timestamp("last_sync_at", { mode: "string", withTimezone: true }),
  status: text("status").notNull().default("draft"),
  ...timestamps(),
});

export const catalogOffers = pgTable("catalog_offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  catalogId: uuid("catalog_id").notNull(),
  productId: uuid("product_id").notNull(),
  sellerOrganizationId: uuid("seller_organization_id").notNull(),
  spaceId: uuid("space_id").references(() => spaces.id),
  orderableUnit: text("orderable_unit").notNull().default("each"),
  priceQuantity: integer("price_quantity").notNull().default(1),
  priceTiers: jsonb("price_tiers")
    .$type<Record<string, unknown>[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  minQty: integer("min_qty").notNull().default(0),
  maxQty: integer("max_qty"),
  orderIncrement: integer("order_increment").notNull().default(1),
  availability: text("availability"),
  leadTime: text("lead_time"),
  validityFrom: timestamp("validity_from", { mode: "string", withTimezone: true }),
  validityTo: timestamp("validity_to", { mode: "string", withTimezone: true }),
  taxIncluded: boolean("tax_included").notNull().default(false),
  status: text("status").notNull().default("active"),
  ...timestamps(),
});

export const buyerAgreements = pgTable("buyer_agreements", {
  id: uuid("id").defaultRandom().primaryKey(),
  catalogOfferId: uuid("catalog_offer_id").notNull(),
  buyerOrganizationId: uuid("buyer_organization_id").notNull(),
  priceTiers: jsonb("price_tiers")
    .$type<Record<string, unknown>[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  validityFrom: timestamp("validity_from", { mode: "string", withTimezone: true }),
  validityTo: timestamp("validity_to", { mode: "string", withTimezone: true }),
  ...timestamps(),
});

export const quoteRequests = pgTable("quote_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  buyerOrganizationId: uuid("buyer_organization_id").notNull(),
  spaceId: uuid("space_id").references(() => spaces.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  items: jsonb("items")
    .$type<Record<string, unknown>[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("open"),
  responseDeadline: timestamp("response_deadline", { mode: "string", withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ...timestamps(),
});

export const quotes = pgTable("quotes", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteRequestId: uuid("quote_request_id").notNull(),
  sellerOrganizationId: uuid("seller_organization_id").notNull(),
  spaceId: uuid("space_id").references(() => spaces.id),
  items: jsonb("items")
    .$type<Record<string, unknown>[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  total: numeric("total").notNull(),
  currency: text("currency").notNull().default("USD"),
  terms: text("terms"),
  status: text("status").notNull().default("submitted"),
  transcript: jsonb("transcript")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  validUntil: timestamp("valid_until", { mode: "string", withTimezone: true }),
  ...timestamps(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteId: uuid("quote_id").notNull(),
  buyerOrganizationId: uuid("buyer_organization_id").notNull(),
  sellerOrganizationId: uuid("seller_organization_id").notNull(),
  spaceId: uuid("space_id").references(() => spaces.id),
  items: jsonb("items")
    .$type<Record<string, unknown>[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  total: numeric("total").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending_approval"),
  approvedByActorId: uuid("approved_by_actor_id"),
  paymentIntentId: uuid("payment_intent_id"),
  ...timestamps(),
});

export const paymentIntents = pgTable("payment_intents", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id").notNull(),
  buyerOrganizationId: uuid("buyer_organization_id").notNull(),
  sellerOrganizationId: uuid("seller_organization_id").notNull(),
  spaceId: uuid("space_id").references(() => spaces.id),
  currency: text("currency").notNull().default("USD"),
  estimatedAmount: numeric("estimated_amount").notNull(),
  status: text("status").notNull().default("draft"),
  provider: text("provider").notNull().default("ledger"),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  approvedByActorId: uuid("approved_by_actor_id"),
  providerReference: text("provider_reference"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  ...timestamps(),
});

export const paymentRecords = pgTable("payment_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentIntentId: uuid("payment_intent_id").notNull(),
  spaceId: uuid("space_id").references(() => spaces.id),
  paidAmount: numeric("paid_amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  providerReference: text("provider_reference"),
  settledAt: timestamp("settled_at", { mode: "string", withTimezone: true }),
  ...timestamps(),
});

export const outreachLists = pgTable(
  "outreach_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    memberPersonIds: uuid("member_person_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    ...timestamps(),
  },
  (table) => [index("outreach_lists_space_id_idx").on(table.spaceId)],
);

export const outreachCampaigns = pgTable(
  "outreach_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    listId: uuid("list_id")
      .notNull()
      .references(() => outreachLists.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id),
    goal: text("goal").notNull(),
    status: text("status").notNull().default("draft"),
    startedAt: timestamp("started_at", { mode: "string", withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("outreach_campaigns_space_id_idx").on(table.spaceId),
    index("outreach_campaigns_list_id_idx").on(table.listId),
  ],
);

export const outreachSteps = pgTable(
  "outreach_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    sendAfterDays: integer("send_after_days").notNull().default(0),
    channel: text("channel").notNull().default("whatsapp"),
    subject: text("subject").notNull().default(""),
    template: text("template").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    ...timestamps(),
  },
  (table) => [index("outreach_steps_campaign_id_idx").on(table.campaignId)],
);

export const outreachSends = pgTable(
  "outreach_sends",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => outreachCampaigns.id, { onDelete: "cascade" }),
    stepId: uuid("step_id")
      .notNull()
      .references(() => outreachSteps.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    status: text("status").notNull().default("queued"),
    scheduledAt: timestamp("scheduled_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    taskId: uuid("task_id").references(() => tasks.id),
    sentAt: timestamp("sent_at", { mode: "string", withTimezone: true }),
    error: text("error"),
    ...timestamps(),
  },
  (table) => [
    index("outreach_sends_campaign_id_idx").on(table.campaignId),
    index("outreach_sends_person_id_idx").on(table.personId),
    index("outreach_sends_campaign_step_person_idx").on(
      table.campaignId,
      table.stepId,
      table.personId,
    ),
  ],
);

export const leadLists = pgTable(
  "lead_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    createdBy: uuid("created_by").references(() => actors.id),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    persona: jsonb("persona")
      .$type<LeadPersona>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    area: jsonb("area").$type<LeadArea | null>(),
    providerId: text("provider_id").notNull(),
    providerConfig: jsonb("provider_config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("draft"),
    error: text("error"),
    leadCount: integer("lead_count").notNull().default(0),
    lastRunAt: timestamp("last_run_at", { mode: "string", withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("lead_lists_space_id_idx").on(table.spaceId),
    index("lead_lists_org_id_idx").on(table.organizationId),
  ],
);

export const leadListMembers = pgTable(
  "lead_list_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    leadListId: uuid("lead_list_id")
      .notNull()
      .references(() => leadLists.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    providerId: text("provider_id").notNull(),
    status: text("status").notNull().default("new"),
    raw: jsonb("raw")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps(),
  },
  (table) => [
    index("lead_list_members_list_idx").on(table.leadListId),
    index("lead_list_members_person_idx").on(table.personId),
  ],
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }),
  createdAt: timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    email: text("email").unique(),
    passwordHash: text("password_hash"),
    provider: text("provider"),
    providerId: text("provider_id"),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    ...timestamps(),
  },
  (table) => ({
    providerIdx: index("users_provider_idx").on(
      table.provider,
      table.providerId,
    ),
  }),
);

export const schema = {
  actors,
  spaces,
  people,
  identities,
  personMergeCandidates,
  modelProviders,
  providerModels,
  agents,
  organizations,
  workspaces,
  roles,
  relationships,
  organicCharts,
  positions,
  goals,
  projects,
  tasks,
  taskLists,
  taskAttachments,
  skills,
  connectors,
  capabilities,
  policies,
  events,
  auditLog,
  secrets,
  channels,
  waAccounts,
  conversations,
  messages,
  memories,
  knowledgeEntities,
  knowledgeEdges,
  reputationEntries,
  treasuryAccounts,
  treasuryLedger,
  treasuryProposals,
  contributionCredits,
  distributionRules,
  suppliers,
  productBase,
  productVariants,
  catalogs,
  catalogOffers,
  buyerAgreements,
  quoteRequests,
  quotes,
  purchaseOrders,
  paymentIntents,
  paymentRecords,
  outreachLists,
  outreachCampaigns,
  outreachSteps,
  outreachSends,
  leadLists,
  leadListMembers,
  sessions,
  users,
};

export type Schema = typeof schema;
