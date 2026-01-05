-- Align products schema with fields used by seller manual add flows.
-- These are ADD-ONLY and safe to run repeatedly.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS video_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sales_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS api_integration jsonb DEFAULT '{}'::jsonb;

