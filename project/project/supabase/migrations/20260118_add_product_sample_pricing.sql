-- Add sample pricing support for Beezio CJ samples.
-- Sample pricing is computed off CJ wholesale cost and stored per product.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sample_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sample_price numeric(10,2);

COMMENT ON COLUMN public.products.sample_enabled IS 'Whether affiliates can purchase a product sample.';
COMMENT ON COLUMN public.products.sample_price IS 'Sample price (typically seller ask + $1/$2 markup).';
