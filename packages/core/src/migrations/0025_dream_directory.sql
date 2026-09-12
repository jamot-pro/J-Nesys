-- The public dream directory behind Discover.
-- The dream statement itself stays on organizations.dream; this table only
-- carries the public presentation layered on top of it.
CREATE TABLE IF NOT EXISTS dream_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  holder_name text NOT NULL DEFAULT '',
  place text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  needs text[] NOT NULL DEFAULT '{}'::text[],
  pay_band text NOT NULL DEFAULT '',
  funded_pct integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dream_listings_org_unique
  ON dream_listings (organization_id);

CREATE TABLE IF NOT EXISTS dream_believers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES actors (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dream_believers_org_idx ON dream_believers (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS dream_believers_unique
  ON dream_believers (organization_id, actor_id);
