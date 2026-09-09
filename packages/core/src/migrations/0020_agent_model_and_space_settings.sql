-- 0020: per-agent model assignment + per-space settings (orchestrator model)
ALTER TABLE agents ADD COLUMN model text;

CREATE TABLE space_settings (
  space_id uuid PRIMARY KEY REFERENCES spaces (id) ON DELETE CASCADE,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
