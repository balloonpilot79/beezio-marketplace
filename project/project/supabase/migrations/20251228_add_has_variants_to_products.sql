-- Track whether a product has selectable variants (sizes/colors/etc).
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.products
  ADD COLUMN IF NOT EXISTS has_variants boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_has_variants ON public.products(has_variants);

