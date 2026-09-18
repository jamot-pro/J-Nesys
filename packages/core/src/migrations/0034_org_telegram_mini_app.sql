-- Per-organization Telegram Mini App config (bot token/username, Mini App
-- name/URL). Dedicated columns, not `blueprint` jsonb, because `blueprint`
-- backs the public /organizations/:slug/branding response.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS telegram_bot_token text,
  ADD COLUMN IF NOT EXISTS telegram_bot_username text,
  ADD COLUMN IF NOT EXISTS telegram_mini_app_name text,
  ADD COLUMN IF NOT EXISTS telegram_mini_app_url text;
