-- Jamot migration 0014 — Outreach app
--
-- Adds the Outreach data model:
--   outreach_lists      — people segments created in the People (CRM) workspace
--   outreach_campaigns  — one source list + one assigned agent + one goal,
--                         with a configurable multi-step sequence
--   outreach_steps      — the sequence steps (delay, channel, message guidance)
--   outreach_sends      — per (campaign, step, person) execution records that
--                         the scheduler turns into tasks for the assigned agent

CREATE TABLE IF NOT EXISTS outreach_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  member_person_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_lists_space_id_idx
  ON outreach_lists (space_id);

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces (id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  list_id uuid NOT NULL REFERENCES outreach_lists (id),
  agent_id uuid NOT NULL REFERENCES agents (id),
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_campaigns_space_id_idx
  ON outreach_campaigns (space_id);
CREATE INDEX IF NOT EXISTS outreach_campaigns_list_id_idx
  ON outreach_campaigns (list_id);

CREATE TABLE IF NOT EXISTS outreach_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns (id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  send_after_days integer NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'whatsapp',
  subject text NOT NULL DEFAULT '',
  template text NOT NULL DEFAULT '',
  instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_steps_campaign_id_idx
  ON outreach_steps (campaign_id);

CREATE TABLE IF NOT EXISTS outreach_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns (id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES outreach_steps (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people (id),
  status text NOT NULL DEFAULT 'queued',
  scheduled_at timestamptz NOT NULL,
  task_id uuid REFERENCES tasks (id),
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_sends_campaign_id_idx
  ON outreach_sends (campaign_id);
CREATE INDEX IF NOT EXISTS outreach_sends_person_id_idx
  ON outreach_sends (person_id);
CREATE INDEX IF NOT EXISTS outreach_sends_campaign_step_person_idx
  ON outreach_sends (campaign_id, step_id, person_id);