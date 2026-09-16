-- Every Lead List result should land in an ordinary People List, the same
-- kind Outreach and the People screen already use (see 0024_people_lists.sql
-- and 0027_one_list_concept.sql, which unified Outreach's lists into this
-- same table). Before this, lead-generation matches only ever went into
-- lead_list_members, invisible to the rest of the platform.
-- ON DELETE SET NULL: deleting the People List must not delete the search
-- history that fed it.
ALTER TABLE lead_lists
  ADD COLUMN IF NOT EXISTS people_list_id uuid REFERENCES people_lists (id) ON DELETE SET NULL;
