-- Deals: the pipeline concept a sales dashboard needs and the schema never
-- had. A lead becomes a deal once someone decides to work it as one; the
-- dashboard's open/won/lost counts and revenue total read straight off this
-- table rather than being invented from lead status.
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  organization_id uuid REFERENCES organizations (id),
  person_id uuid REFERENCES people (id) ON DELETE SET NULL,
  agent_id uuid REFERENCES agents (id) ON DELETE SET NULL,
  created_by uuid REFERENCES actors (id),
  lead_list_id uuid REFERENCES lead_lists (id) ON DELETE SET NULL,
  title text NOT NULL,
  value_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stage text NOT NULL DEFAULT 'open',
  source text,
  notes text NOT NULL DEFAULT '',
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deals_space_id_idx ON deals (space_id);
CREATE INDEX IF NOT EXISTS deals_organization_id_idx ON deals (organization_id);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals (stage);
