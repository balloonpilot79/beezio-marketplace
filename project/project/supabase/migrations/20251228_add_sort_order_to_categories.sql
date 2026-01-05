-- Add sort_order to categories (used by UI ordering)
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.categories
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

