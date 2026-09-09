-- 0018_skills_body.sql
-- Markdown is the authoring format for skills: one body field is the source
-- of truth; structured columns stay for machine-readable metadata.
ALTER TABLE skills ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '';
