-- Concise, maintained "what we know about this person" summary, rebuilt from
-- their memory entries after each interaction. Nullable until first refresh.
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS context_summary text,
  ADD COLUMN IF NOT EXISTS context_summary_updated_at timestamptz;
