ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS package_length_in numeric,
  ADD COLUMN IF NOT EXISTS package_width_in numeric,
  ADD COLUMN IF NOT EXISTS package_height_in numeric;

COMMENT ON COLUMN public.products.base_weight_oz IS 'Package shipping weight in ounces used for live carrier rates.';
COMMENT ON COLUMN public.products.package_length_in IS 'Package shipping length in inches used for live carrier rates.';
COMMENT ON COLUMN public.products.package_width_in IS 'Package shipping width in inches used for live carrier rates.';
COMMENT ON COLUMN public.products.package_height_in IS 'Package shipping height in inches used for live carrier rates.';
