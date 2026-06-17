-- Extend variants + order items for Printful/Printify integrations

-- Allow non-CJ variants
ALTER TABLE public.product_variants
  ALTER COLUMN cj_product_id DROP NOT NULL,
  ALTER COLUMN cj_variant_id DROP NOT NULL;

-- External provider mapping fields
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS source_platform text,
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS external_variant_id text,
  ADD COLUMN IF NOT EXISTS external_data jsonb DEFAULT '{}'::jsonb;

-- Allow additional inventory sources
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_inventory_source_check') THEN
    ALTER TABLE public.product_variants DROP CONSTRAINT product_variants_inventory_source_check;
  END IF;

  ALTER TABLE public.product_variants
    ADD CONSTRAINT product_variants_inventory_source_check
    CHECK (inventory_source IN ('manual','cj','printful','printify'));
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_external_variant
  ON public.product_variants (source_platform, external_variant_id)
  WHERE source_platform IS NOT NULL AND external_variant_id IS NOT NULL;

-- Order items external provider snapshot
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS source_platform text,
  ADD COLUMN IF NOT EXISTS external_product_id text,
  ADD COLUMN IF NOT EXISTS external_variant_id text;

CREATE INDEX IF NOT EXISTS idx_order_items_external_variant
  ON public.order_items (source_platform, external_variant_id);
