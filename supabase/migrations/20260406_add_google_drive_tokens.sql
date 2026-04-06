-- Add columns to store Google OAuth tokens for Drive access
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_access_token text,
  ADD COLUMN IF NOT EXISTS google_refresh_token text;

-- RLS: only the user themselves can read/update their own tokens
-- (existing RLS policies already restrict profiles to own row)
