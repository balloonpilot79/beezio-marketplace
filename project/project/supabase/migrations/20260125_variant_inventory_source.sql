-- Add inventory_source to variants for CJ sync routing
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS inventory_source text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_inventory_source_check') THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_inventory_source_check CHECK (inventory_source IN ('manual','cj'));
  END IF;
END $$;

