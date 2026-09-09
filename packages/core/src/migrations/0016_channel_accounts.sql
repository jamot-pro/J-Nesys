-- Jamot migration 0016 — generic channel accounts (telegram / matrix) per space

CREATE TABLE IF NOT EXISTS channel_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id),
  protocol text NOT NULL CHECK (protocol IN ('telegram', 'matrix')),
  label text NOT NULL,
  identifier text,
  token text,
  status text NOT NULL DEFAULT 'offline',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS channel_accounts_space_id_idx
  ON channel_accounts (space_id);