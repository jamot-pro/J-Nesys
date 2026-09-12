-- Outreach lists and People lists were two unrelated concepts, so a list built
-- in People could not be used for a campaign. Remember where an outreach list
-- came from, so its members can be refreshed from the source rather than
-- drifting away from it.
ALTER TABLE outreach_lists
  ADD COLUMN IF NOT EXISTS source_people_list_id uuid
  REFERENCES people_lists (id) ON DELETE SET NULL;
