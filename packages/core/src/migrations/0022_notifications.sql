-- Real, persisted per-actor notifications, replacing the stub that faked
-- items on the fly from open tasks and no-op'd on mark-read.

CREATE TYPE notification_type AS ENUM (
  'approval',
  'completed',
  'warning',
  'opportunity',
  'proposal',
  'message'
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  target_section text,
  target_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_actor_space_idx ON notifications (actor_id, space_id);
