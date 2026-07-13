-- Retire CJ Dropshipping and AliExpress without deleting historical products,
-- orders, imported-product links, or tracking data.
DO $$
DECLARE
  product_set_sql text := '';
  product_match_sql text := 'false';
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    -- The recovered and legacy schemas do not all have the same supplier
    -- columns. Build the update from the columns that actually exist so this
    -- migration remains safe on both versions without deleting order history.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_active'
    ) THEN
      product_set_sql := 'is_active = false';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'affiliate_enabled'
    ) THEN
      product_set_sql := concat_ws(', ', nullif(product_set_sql, ''), 'affiliate_enabled = false');
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_promotable'
    ) THEN
      product_set_sql := concat_ws(', ', nullif(product_set_sql, ''), 'is_promotable = false');
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'auto_sync'
    ) THEN
      product_set_sql := concat_ws(', ', nullif(product_set_sql, ''), 'auto_sync = false');
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'source_platform'
    ) THEN
      product_match_sql := product_match_sql ||
        ' OR lower(coalesce(source_platform, '''')) IN (''cj'', ''cjdropshipping'', ''cj dropshipping'', ''aliexpress'')';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'lineage'
    ) THEN
      product_match_sql := product_match_sql ||
        ' OR lower(coalesce(lineage, '''')) IN (''cj'', ''cjdropshipping'', ''cj dropshipping'', ''aliexpress'')';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'cj_product_id'
    ) THEN
      product_match_sql := product_match_sql ||
        ' OR nullif(trim(coalesce(cj_product_id, '''')), '''') IS NOT NULL';
    END IF;

    IF product_set_sql <> '' THEN
      EXECUTE 'UPDATE public.products SET ' || product_set_sql || ' WHERE ' || product_match_sql;
    END IF;
  END IF;

  IF to_regclass('public.user_integrations') IS NOT NULL THEN
    UPDATE public.user_integrations
    SET is_active = false,
        status = 'inactive',
        updated_at = now()
    WHERE lower(coalesce(platform, '')) IN ('cj', 'cjdropshipping', 'cj dropshipping', 'aliexpress');
  END IF;
END $$;
