-- Jamot migration 0010 — workspaces: org-owned spaces as tenant containers

-- A workspace is an org-owned space. Every tenant data entity keys on
-- spaces.id via space_id, so adding workspace rows (org->space) gives each
-- workspace fully isolated data without touching existing space-scoped tables.

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  space_id uuid NOT NULL UNIQUE REFERENCES spaces(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspaces_organization_id_idx ON workspaces (organization_id);

-- Backfill: every existing organization's space becomes its default workspace.
INSERT INTO workspaces (organization_id, space_id, name)
SELECT o.id, o.space_id, COALESCE(s.name, 'Default')
FROM organizations o
LEFT JOIN spaces s ON s.id = o.space_id
ON CONFLICT (space_id) DO NOTHING;

-- Scope previously global tenant data to a workspace space.
ALTER TABLE knowledge_entities ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE knowledge_edges ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE product_base ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE catalog_offers ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS space_id uuid REFERENCES spaces(id);

CREATE INDEX IF NOT EXISTS knowledge_entities_space_id_idx ON knowledge_entities (space_id);
CREATE INDEX IF NOT EXISTS product_base_space_id_idx ON product_base (space_id);
CREATE INDEX IF NOT EXISTS purchase_orders_space_id_idx ON purchase_orders (space_id);
CREATE INDEX IF NOT EXISTS payment_intents_space_id_idx ON payment_intents (space_id);
