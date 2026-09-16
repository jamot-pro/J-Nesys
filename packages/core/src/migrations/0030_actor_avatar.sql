-- An agent is a first-class Actor, and its Profile step needs a picture —
-- until now only Person rows (avatarUrl/avatarSource) had one.
ALTER TABLE actors ADD COLUMN IF NOT EXISTS avatar_url text;
