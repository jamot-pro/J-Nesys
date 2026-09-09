-- Jamot memory + knowledge (Phase 5).
-- Dev-stage migration: the `memories` table is dropped and recreated with the
-- corrected scoped-memory shape. Acceptable during development; a proper
-- ALTER-based migration must be written before any production rollout.
-- Requires pgcrypto (created in 0001_init.sql).

DROP TABLE IF EXISTS memories;

CREATE TABLE memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  owner_id uuid NOT NULL,
  content jsonb NOT NULL,
  source_event_id uuid,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memories_scope_owner_id_idx ON memories (scope, owner_id);

CREATE TABLE knowledge_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL,
  target_id uuid NOT NULL,
  relation text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_edges_source_id_idx ON knowledge_edges (source_id);
CREATE INDEX knowledge_edges_target_id_idx ON knowledge_edges (target_id);
