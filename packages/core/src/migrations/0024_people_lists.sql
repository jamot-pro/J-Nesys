-- Named groupings of people inside a space, for the People screen.
-- Membership is explicit and many-to-many; dropping a list never drops people.
CREATE TABLE IF NOT EXISTS people_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations (id),
  space_id uuid NOT NULL REFERENCES spaces (id),
  created_by uuid REFERENCES actors (id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS people_lists_space_id_idx ON people_lists (space_id);
CREATE INDEX IF NOT EXISTS people_lists_org_id_idx ON people_lists (organization_id);

CREATE TABLE IF NOT EXISTS people_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  people_list_id uuid NOT NULL REFERENCES people_lists (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS people_list_members_list_idx ON people_list_members (people_list_id);
CREATE INDEX IF NOT EXISTS people_list_members_person_idx ON people_list_members (person_id);
CREATE UNIQUE INDEX IF NOT EXISTS people_list_members_unique
  ON people_list_members (people_list_id, person_id);
