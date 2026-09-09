-- 0017_people_identities.sql
-- Canonical identity layer: ONE Person with many channel identities attached.
-- Identities are normalized (unique per provider+value) so cross-channel
-- resolution and search scale; provenance lives on the identity itself.

CREATE TABLE IF NOT EXISTS identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  person_id uuid REFERENCES people(id) ON DELETE CASCADE,
  provider text NOT NULL,
  value text NOT NULL,
  verified boolean NOT NULL DEFAULT true,
  confidence real NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'observed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identities_provider_value_key UNIQUE (provider, value)
);

CREATE INDEX IF NOT EXISTS identities_actor_id_idx ON identities (actor_id);
CREATE INDEX IF NOT EXISTS identities_person_id_idx ON identities (person_id);

-- People: first-class searchable fields + timestamps + consent + activity.
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_source text,
  ADD COLUMN IF NOT EXISTS consent jsonb,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS people_actor_id_idx ON people (actor_id);
CREATE INDEX IF NOT EXISTS people_email_lower_idx ON people (lower(email));
CREATE INDEX IF NOT EXISTS people_phone_idx ON people (phone);
CREATE INDEX IF NOT EXISTS people_last_interaction_idx ON people (last_interaction_at);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS people_name_trgm_idx ON people USING gin (
  (coalesce(first_name, '') || ' ' || coalesce(last_name, '')) gin_trgm_ops
);

-- Uncertain identity matches are recorded for human review, never auto-merged.
CREATE TABLE IF NOT EXISTS person_merge_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid REFERENCES spaces(id) ON DELETE SET NULL,
  person_a_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  person_b_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  reason text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'merged', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_merge_candidates_status_idx
  ON person_merge_candidates (status);
CREATE INDEX IF NOT EXISTS person_merge_candidates_people_idx
  ON person_merge_candidates (person_a_id, person_b_id);

-- Google becomes a first-class connector provider (People + Gmail).
ALTER TYPE connector_provider ADD VALUE IF NOT EXISTS 'google';

-- Backfill identities from the legacy actors.external_identities jsonb.
INSERT INTO identities (actor_id, provider, value, verified, source)
SELECT
  a.id,
  ei ->> 'provider',
  ei ->> 'value',
  coalesce((ei ->> 'verified')::boolean, false),
  'observed'
FROM actors a,
     jsonb_array_elements(a.external_identities) AS ei
WHERE jsonb_typeof(a.external_identities) = 'array'
  AND jsonb_array_length(a.external_identities) > 0
  AND ei ->> 'provider' IS NOT NULL
  AND ei ->> 'value' IS NOT NULL
ON CONFLICT (provider, value) DO NOTHING;

UPDATE identities i
SET person_id = p.id
FROM people p
WHERE p.actor_id = i.actor_id AND i.person_id IS NULL;
