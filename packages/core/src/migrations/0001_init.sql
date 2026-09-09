-- Jamot domain core — initial schema (Postgres 16).
-- Source of truth for the Phase 1 domain model. Applied manually via psql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE actor_type AS ENUM ('human', 'agent');
CREATE TYPE actor_source AS ENUM ('internal', 'external');
CREATE TYPE actor_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE space_kind AS ENUM ('personal', 'organization');
CREATE TYPE role_kind AS ENUM ('owner', 'admin', 'member', 'agent', 'external');
CREATE TYPE goal_status AS ENUM ('active', 'done', 'archived');
CREATE TYPE task_status AS ENUM ('created', 'assigned', 'started', 'completed', 'cancelled');
CREATE TYPE task_target_type AS ENUM ('human', 'agent', 'human_agent', 'organization', 'external');
CREATE TYPE skill_status AS ENUM ('draft', 'validated', 'deprecated');
CREATE TYPE connector_provider AS ENUM ('whatsapp', 'telegram', 'google_calendar', 'github', 'stripe', 'erp', 'database', 'matrix', 'discord', 'custom');
CREATE TYPE connector_type AS ENUM ('channel', 'mcp', 'harness', 'ai_provider', 'data');
CREATE TYPE connector_status AS ENUM ('connected', 'disconnected', 'error');
CREATE TYPE autonomy AS ENUM ('suggest', 'approve', 'autonomous');
CREATE TYPE availability AS ENUM ('available', 'busy', 'offline');
CREATE TYPE policy_decision AS ENUM ('allow', 'deny', 'require_human', 'require_admin', 'require_multisig');
CREATE TYPE secret_scope AS ENUM ('user', 'organization', 'system', 'environment');

CREATE TABLE actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type actor_type NOT NULL,
  source actor_source NOT NULL DEFAULT 'internal',
  display_name text NOT NULL,
  status actor_status NOT NULL DEFAULT 'active',
  external_identities jsonb NOT NULL DEFAULT '[]'::jsonb,
  personal_space_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind space_kind NOT NULL,
  owner_actor_id uuid NOT NULL REFERENCES actors (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE actors
  ADD CONSTRAINT actors_personal_space_id_fkey
  FOREIGN KEY (personal_space_id) REFERENCES spaces (id);

CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES actors (id),
  email text,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  membership_space_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  reputation jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES actors (id),
  owner_id uuid NOT NULL REFERENCES actors (id),
  organization_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  role text,
  harness jsonb NOT NULL,
  skill_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  capability_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  permissions uuid[] NOT NULL DEFAULT '{}'::uuid[],
  autonomy autonomy NOT NULL DEFAULT 'approve',
  budget numeric,
  heartbeat jsonb NOT NULL DEFAULT '{"enabled":false,"cron":null,"quietHours":null}'::jsonb,
  availability availability NOT NULL DEFAULT 'offline',
  performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  dream text NOT NULL DEFAULT '',
  blueprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_app_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  treasury_id uuid,
  reputation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES actors (id),
  space_id uuid NOT NULL REFERENCES spaces (id),
  kind role_kind NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX roles_actor_id_idx ON roles (actor_id);
CREATE INDEX roles_space_id_idx ON roles (space_id);

CREATE TABLE organic_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  name text NOT NULL,
  root_position_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  chart_id uuid NOT NULL REFERENCES organic_charts (id),
  title text NOT NULL,
  parent_position_id uuid REFERENCES positions (id),
  holder_actor_id uuid REFERENCES actors (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  parent_goal_id uuid REFERENCES goals (id),
  title text NOT NULL,
  status goal_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  goal_id uuid REFERENCES goals (id),
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  project_id uuid REFERENCES projects (id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status task_status NOT NULL DEFAULT 'created',
  assignee_actor_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  target_type task_target_type NOT NULL DEFAULT 'human',
  required_capability_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  outcome jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tasks_space_id_idx ON tasks (space_id);

CREATE TABLE skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_actor_id uuid REFERENCES actors (id),
  owner_organization_id uuid REFERENCES organizations (id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '1.0.0',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  prerequisites uuid[] NOT NULL DEFAULT '{}'::uuid[],
  allowed_capability_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  evaluation_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance jsonb NOT NULL,
  status skill_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider connector_provider NOT NULL,
  type connector_type NOT NULL DEFAULT 'channel',
  owner_actor_id uuid REFERENCES actors (id),
  owner_organization_id uuid REFERENCES organizations (id),
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  credential_ref jsonb NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  status connector_status NOT NULL DEFAULT 'disconnected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  skill_id uuid NOT NULL REFERENCES skills (id),
  connector_id uuid NOT NULL REFERENCES connectors (id),
  policy_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  space_id uuid NOT NULL REFERENCES spaces (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  name text NOT NULL,
  capability text NOT NULL,
  resource text NOT NULL DEFAULT '*',
  min_role role_kind,
  risk_threshold numeric NOT NULL DEFAULT 0.5,
  decision policy_decision NOT NULL
);

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  space_id uuid,
  actor_id uuid,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  delivered boolean NOT NULL DEFAULT false
);

CREATE INDEX events_type_idx ON events (type);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid,
  actor_id uuid,
  action text NOT NULL,
  resource text NOT NULL,
  resource_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,
  scope secret_scope NOT NULL,
  owner_actor_id uuid,
  owner_organization_id uuid,
  ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  name text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  channel_id uuid REFERENCES channels (id),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations (id),
  actor_id uuid,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid,
  actor_id uuid,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reputation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  space_id uuid,
  kind text NOT NULL,
  value numeric NOT NULL,
  provenance jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE treasury_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL,
  name text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE treasury_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  entry_type text NOT NULL,
  amount numeric NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE treasury_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  proposer_actor_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  amount numeric NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contribution_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  space_id uuid,
  amount numeric NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE distribution_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL,
  name text NOT NULL,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  token_hash text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
