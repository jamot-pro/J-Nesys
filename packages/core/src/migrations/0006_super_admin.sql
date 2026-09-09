-- Jamot migration 0006 — super admin flag on auth users

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);

-- Store App Registry ids (non-uuid strings like "crm") on organizations.
ALTER TABLE organizations ALTER COLUMN enabled_app_ids TYPE text[]
  USING enabled_app_ids::uuid[]::text[];