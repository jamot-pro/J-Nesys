-- Jamot migration 0007 — WhatsApp channel accounts per org (space)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wa_account_status') THEN
    CREATE TYPE wa_account_status AS ENUM (
      'offline',
      'pairing',
      'connecting',
      'connected',
      'error'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS wa_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id),
  label text NOT NULL,
  phone text,
  status wa_account_status NOT NULL DEFAULT 'offline',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_accounts_space_id_idx ON wa_accounts (space_id);