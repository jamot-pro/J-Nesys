-- Jamot migration 0013 — Agent configuration surface
--
-- Extends `agents` with the fields surfaced by the Agent Configuration UI
-- (identity purpose/description, connector grants, memory scopes, event
-- subscriptions, deterministic schedules, per-action permissions, system
-- prompt). Also introduces the actor-to-actor `relationships` table used by
-- the "Who does the agent work with?" section.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS connector_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS memory_scopes text[] NOT NULL DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS subscribed_events text[] NOT NULL DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS schedules jsonb NOT NULL DEFAULT '[]';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS action_permissions jsonb NOT NULL DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt text;

CREATE TABLE IF NOT EXISTS relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_actor_id uuid NOT NULL REFERENCES actors (id) ON DELETE CASCADE,
  to_actor_id uuid NOT NULL REFERENCES actors (id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relationships_from_actor_idx
  ON relationships (from_actor_id);
CREATE INDEX IF NOT EXISTS relationships_to_actor_idx
  ON relationships (to_actor_id);