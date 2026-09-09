-- Jamot migration 0005 — Kanban task lists + attachments + task ordering/due date

CREATE TABLE IF NOT EXISTS task_lists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id      uuid NOT NULL REFERENCES spaces(id),
  name          text NOT NULL,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES task_lists(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date timestamptz;

CREATE INDEX IF NOT EXISTS tasks_list_id_idx ON tasks (list_id);

CREATE TABLE IF NOT EXISTS task_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES tasks(id),
  name          text NOT NULL,
  mime_type     text NOT NULL DEFAULT 'application/octet-stream',
  size          integer NOT NULL DEFAULT 0,
  data          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
