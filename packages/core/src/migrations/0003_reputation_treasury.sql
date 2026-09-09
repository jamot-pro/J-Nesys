-- Jamot reputation + treasury (Phase 9).
-- Dev-stage migration: the six tables are dropped and recreated with the
-- corrected capability/evidence and organization-ledger shapes. Acceptable
-- during development; a proper ALTER-based migration must be written before
-- any production rollout. Requires pgcrypto (created in 0001_init.sql).

DROP TABLE IF EXISTS reputation_entries;
DROP TABLE IF EXISTS treasury_accounts;
DROP TABLE IF EXISTS treasury_ledger;
DROP TABLE IF EXISTS treasury_proposals;
DROP TABLE IF EXISTS contribution_credits;
DROP TABLE IF EXISTS distribution_rules;

CREATE TABLE reputation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  capability text NOT NULL,
  score numeric NOT NULL,
  evidence jsonb NOT NULL,
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reputation_entries_actor_capability_idx
  ON reputation_entries (actor_id, capability);

CREATE TABLE treasury_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric NOT NULL DEFAULT 0
);

CREATE TABLE treasury_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  entry_type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE treasury_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  proposed_by_actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contribution_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  capability text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE distribution_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  capability text NOT NULL,
  share numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
