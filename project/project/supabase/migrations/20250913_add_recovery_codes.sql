-- Add recovery_codes column to profiles to store hashed recovery codes
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS recovery_codes text[] DEFAULT '{}'::text[];

-- Service role (admin) can bypass RLS; no additional policy edits required here.
