-- Jamot migration 0011 — org subdomains, logo, workspace config
--
-- Each organization can own a slug (subdomain): <slug>.jamot.pro resolves to
-- that org on the shared web app. logo_url stores a self-hosted upload path
-- (served from /uploads) or an absolute URL. Workspaces gain a config blob so
-- every workspace can have its own settings/configuration.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx
  ON organizations (slug) WHERE slug IS NOT NULL;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
