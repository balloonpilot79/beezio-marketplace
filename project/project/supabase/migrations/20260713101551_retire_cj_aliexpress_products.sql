-- Retire CJ Dropshipping and AliExpress without deleting historical products,
-- orders, imported-product links, or tracking data.
DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    UPDATE public.products
    SET is_active = false,
        affiliate_enabled = false,
        is_promotable = false,
        auto_sync = false
    WHERE lower(coalesce(source_platform, '')) IN ('cj', 'cjdropshipping', 'cj dropshipping', 'aliexpress')
       OR lower(coalesce(lineage, '')) IN ('cj', 'cjdropshipping', 'cj dropshipping', 'aliexpress')
       OR nullif(trim(coalesce(cj_product_id, '')), '') IS NOT NULL;
  END IF;

  IF to_regclass('public.user_integrations') IS NOT NULL THEN
    UPDATE public.user_integrations
    SET is_active = false,
        status = 'inactive',
        updated_at = now()
    WHERE lower(coalesce(platform, '')) IN ('cj', 'cjdropshipping', 'cj dropshipping', 'aliexpress');
  END IF;
END $$;
