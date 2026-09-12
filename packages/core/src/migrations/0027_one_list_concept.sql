-- One list concept.
--
-- Lists existed twice: outreach_lists (curated by the cockpit's People screen,
-- referenced by campaigns) and people_lists (curated by the console's People
-- screen). Same idea, two tables, invisible to each other.
--
-- people_lists wins: membership is a real join table rather than a uuid[], so
-- two writers cannot clobber each other and a membership can be dated.
--
-- Every outreach list becomes a people list, campaigns point at that, and
-- outreach_lists is left in place — unread from here on — so this is
-- recoverable without restoring a backup.

-- 1. Every outreach list that did not come from a people list becomes one.
INSERT INTO people_lists (id, space_id, name, created_at, updated_at)
SELECT gen_random_uuid(), o.space_id, o.name, o.created_at, o.updated_at
FROM outreach_lists o
WHERE o.source_people_list_id IS NULL;

-- Link each converted list back to its origin. Matching on (space, name,
-- created_at) is exact here because the rows were just inserted from it.
UPDATE outreach_lists o
SET source_people_list_id = p.id
FROM people_lists p
WHERE o.source_people_list_id IS NULL
  AND p.space_id = o.space_id
  AND p.name = o.name
  AND p.created_at = o.created_at;

-- 2. Carry the members over, skipping any person row that no longer exists.
INSERT INTO people_list_members (people_list_id, person_id)
SELECT o.source_people_list_id, m.person_id
FROM outreach_lists o
CROSS JOIN LATERAL unnest(o.member_person_ids) AS m(person_id)
WHERE o.source_people_list_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM people p WHERE p.id = m.person_id)
ON CONFLICT (people_list_id, person_id) DO NOTHING;

-- 3. Campaigns point at the people list instead.
ALTER TABLE outreach_campaigns
  ADD COLUMN IF NOT EXISTS people_list_id uuid REFERENCES people_lists (id);

UPDATE outreach_campaigns c
SET people_list_id = o.source_people_list_id
FROM outreach_lists o
WHERE c.list_id = o.id
  AND c.people_list_id IS NULL;

CREATE INDEX IF NOT EXISTS outreach_campaigns_people_list_id_idx
  ON outreach_campaigns (people_list_id);

-- list_id stays, nullable, written by nothing. Dropping it is a later change,
-- once this has run somewhere real.
ALTER TABLE outreach_campaigns ALTER COLUMN list_id DROP NOT NULL;
