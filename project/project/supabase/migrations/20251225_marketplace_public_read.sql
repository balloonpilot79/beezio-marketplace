-- Marketplace visibility + public read policies (idempotent)
-- Fixes cases where CJ imports succeed but marketplace shows only sample data due to RLS/grants.

-- 1) Products: ensure key visibility columns exist + are populated.
DO $$
BEGIN
  IF to_regclass('public.products') IS NULL THEN
    RAISE NOTICE 'Table public.products does not exist; skipping.';
    RETURN;
  END IF;

  ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS affiliate_enabled boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS is_promotable boolean NOT NULL DEFAULT true;

  -- Backfill nulls (older rows / partial inserts).
  UPDATE public.products SET is_active = true WHERE is_active IS NULL;
  UPDATE public.products SET affiliate_enabled = true WHERE affiliate_enabled IS NULL;
  UPDATE public.products SET is_promotable = true WHERE is_promotable IS NULL;

  -- Ensure CJ imports are visible by default (best-effort; won't override explicit false flags).
  UPDATE public.products
    SET is_active = true,
        affiliate_enabled = true,
        is_promotable = true
  WHERE lower(coalesce(lineage, '')) = 'cj'
    AND (is_active IS DISTINCT FROM true OR affiliate_enabled IS DISTINCT FROM true OR is_promotable IS DISTINCT FROM true);

  ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

  -- Ensure grants exist (RLS policies still apply).
  GRANT SELECT ON public.products TO anon, authenticated;

  -- Public can read active products (marketplace/storefronts). Owners/admins can be handled by other policies.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products'
      AND policyname = 'products_public_select_active'
  ) THEN
    CREATE POLICY products_public_select_active
      ON public.products
      FOR SELECT
      TO anon, authenticated
      USING (is_active = true);
  END IF;
END $$;

-- 2) Product variants: allow public to read active variants for active products.
DO $$
BEGIN
  IF to_regclass('public.product_variants') IS NULL THEN
    RAISE NOTICE 'Table public.product_variants does not exist; skipping.';
    RETURN;
  END IF;

  ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON public.product_variants TO anon, authenticated;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_variants'
      AND policyname = 'product_variants_public_select_active'
  ) THEN
    CREATE POLICY product_variants_public_select_active
      ON public.product_variants
      FOR SELECT
      TO anon, authenticated
      USING (
        coalesce(is_active, true) = true
        AND EXISTS (
          SELECT 1
          FROM public.products p
          WHERE p.id = product_variants.product_id
            AND p.is_active = true
        )
      );
  END IF;
END $$;

-- 3) Shipping options: allow public reads (needed for checkout/shipping selector).
DO $$
BEGIN
  IF to_regclass('public.shipping_options') IS NULL THEN
    RAISE NOTICE 'Table public.shipping_options does not exist; skipping.';
    RETURN;
  END IF;

  ALTER TABLE public.shipping_options ENABLE ROW LEVEL SECURITY;
  GRANT SELECT ON public.shipping_options TO anon, authenticated;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shipping_options'
      AND policyname = 'shipping_options_public_select'
  ) THEN
    CREATE POLICY shipping_options_public_select
      ON public.shipping_options
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.products p
          WHERE p.id = shipping_options.product_id
            AND p.is_active = true
        )
      );
  END IF;
END $$;

-- 4) Categories: allow public read if the table exists (some deployments use product_categories instead).
DO $$
BEGIN
  IF to_regclass('public.categories') IS NULL THEN
    RETURN;
  END IF;

  -- If RLS is enabled, ensure a permissive read policy exists.
  BEGIN
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN insufficient_privilege THEN
    -- ignore
  END;

  GRANT SELECT ON public.categories TO anon, authenticated;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'categories'
      AND policyname = 'categories_public_select'
  ) THEN
    CREATE POLICY categories_public_select
      ON public.categories
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

