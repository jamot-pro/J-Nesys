-- A lead list remembers which agents work it.
-- Lead generation offered agent pickers that saved nothing; these are where
-- the choice goes. ON DELETE SET NULL: removing an agent must not remove the
-- list it happened to be assigned to.
ALTER TABLE lead_lists
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES agents (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrichment_agent_id uuid REFERENCES agents (id) ON DELETE SET NULL;
