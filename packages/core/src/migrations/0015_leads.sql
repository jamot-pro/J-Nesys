-- Jamot migration 0015 — Lead generation & enrichment app
--
-- Adds the lead research model:
--   lead_lists         — research campaigns: a map area + target persona + a
--                        configured provider (Apollo.io / Composio / MCP)
--   lead_list_members  — the leads collected for a list, joined to People rows
--                        with the raw provider payload + provenance snapshot

CREATE TABLE IF NOT EXISTS lead_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations (id),
  space_id uuid NOT NULL REFERENCES spaces (id),
  created_by uuid REFERENCES actors (id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  persona jsonb NOT NULL DEFAULT '{}'::jsonb,
  area jsonb,
  provider_id text NOT NULL,
  provider_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  error text,
  lead_count integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_lists_space_id_idx ON lead_lists (space_id);
CREATE INDEX IF NOT EXISTS lead_lists_org_id_idx ON lead_lists (organization_id);

CREATE TABLE IF NOT EXISTS lead_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_list_id uuid NOT NULL REFERENCES lead_lists (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people (id),
  provider_id text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_list_members_list_idx
  ON lead_list_members (lead_list_id);
CREATE INDEX IF NOT EXISTS lead_list_members_person_idx
  ON lead_list_members (person_id);