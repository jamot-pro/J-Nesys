-- A people list remembers which agent answers inbound messages from anyone
-- on it. ON DELETE SET NULL: removing an agent must not remove the list.
ALTER TABLE people_lists
  ADD COLUMN IF NOT EXISTS reply_agent_id uuid REFERENCES agents (id) ON DELETE SET NULL;
