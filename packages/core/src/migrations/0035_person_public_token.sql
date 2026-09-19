-- Opaque token for a person's unauthenticated public profile page
-- (/p/<token>). Unique when set; most people never get one.
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS public_token text;

CREATE UNIQUE INDEX IF NOT EXISTS people_public_token_idx
  ON people (public_token)
  WHERE public_token IS NOT NULL;
