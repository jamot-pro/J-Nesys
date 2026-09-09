-- Jamot migration 0012 — Composio connector interface
--
-- Composio becomes the unified connector layer: every connected account is a
-- `connectors` row with provider = 'composio'. The `sharing` column models the
-- org model (org-shared vs user-private/personal). `composio_oauth_states`
-- persists pending OAuth handshakes so the callback is bound to the acting
-- session/scope and validated against a one-time `state` token.

ALTER TYPE connector_provider ADD VALUE IF NOT EXISTS 'composio';

ALTER TABLE connectors ADD COLUMN IF NOT EXISTS sharing text NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS composio_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL UNIQUE,
  actor_id uuid NOT NULL REFERENCES actors (id),
  organization_id uuid REFERENCES organizations (id),
  sharing text NOT NULL DEFAULT 'user',
  toolkit text NOT NULL,
  composio_user_id text NOT NULL,
  api_key_scope secret_scope NOT NULL,
  redirect_uri text NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS composio_oauth_states_state_idx
  ON composio_oauth_states (state);