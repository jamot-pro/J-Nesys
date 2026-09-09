-- Jamot migration 0004 — auth users table
-- Auth users (email/password + OAuth provider identities) live here, outside
-- the core domain layer. Dev-stage DROP+recreate is acceptable (no prod data).

DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     uuid NOT NULL,
  actor_id      uuid NOT NULL,
  email         text UNIQUE,
  password_hash text,
  provider      text,
  provider_id   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_provider_idx ON users (provider, provider_id);
