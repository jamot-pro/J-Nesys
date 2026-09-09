-- Org-registered app manifests, so orgs can install/manage apps beyond the
-- fixed built-in catalog (packages/core/src/apps/registry.ts SAMPLE_APPS).
-- These are scoped per-organization and merged with the built-in catalog at
-- read time - never written into the shared in-process AppRegistry, so one
-- org's custom app never leaks into another org's listing.

CREATE TABLE custom_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  description text NOT NULL DEFAULT '',
  entities text[] NOT NULL DEFAULT '{}',
  capabilities text[] NOT NULL DEFAULT '{}',
  tools text[] NOT NULL DEFAULT '{}',
  events text[] NOT NULL DEFAULT '{}',
  hooks text[] NOT NULL DEFAULT '{}',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  canvas text[] NOT NULL DEFAULT '{}',
  permissions text[] NOT NULL DEFAULT '{}',
  created_by_actor_id uuid NOT NULL REFERENCES actors(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX custom_apps_organization_id_idx ON custom_apps (organization_id);
CREATE UNIQUE INDEX custom_apps_org_slug_unique ON custom_apps (organization_id, slug);
