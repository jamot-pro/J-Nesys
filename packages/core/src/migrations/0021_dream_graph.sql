-- Vibe DREAM Configurator — organizational graph (Phase 1).
-- Adds first-class DREAM / TEAM / RESPONSIBILITY / HEARTBEAT / TOOL graph nodes
-- and typed edges, superseding the (untouched, backward-compatible)
-- organic_charts / positions parent-pointer tables. Every org graph mutation
-- is also written to organizational memory as a scoped event.

CREATE TYPE org_node_kind AS ENUM (
  'dream',
  'team',
  'human',
  'agent',
  'responsibility',
  'tool',
  'heartbeat'
);

CREATE TYPE org_edge_relation AS ENUM (
  'requires',
  'owns',
  'member_of',
  'responsible_for',
  'uses',
  'has_access_to',
  'monitors',
  'invokes',
  'depends_on'
);

CREATE TABLE org_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  space_id uuid REFERENCES spaces(id) ON DELETE SET NULL,
  kind org_node_kind NOT NULL,
  name text NOT NULL,
  ref_id uuid,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position_x real NOT NULL DEFAULT 0,
  position_y real NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_nodes_org_idx ON org_nodes (organization_id);
CREATE INDEX org_nodes_space_idx ON org_nodes (space_id);

CREATE TABLE org_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  space_id uuid REFERENCES spaces(id) ON DELETE SET NULL,
  from_node_id uuid NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES org_nodes(id) ON DELETE CASCADE,
  relation org_edge_relation NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_edges_org_idx ON org_edges (organization_id);
CREATE INDEX org_edges_from_idx ON org_edges (from_node_id);
CREATE INDEX org_edges_to_idx ON org_edges (to_node_id);