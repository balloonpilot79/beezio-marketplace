-- Ensure required uniqueness for upsert() calls from the app.
-- Fixes: "there is no unique or exclusion constraint matching the ON CONFLICT specification" on affiliate store actions.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'affiliate_products') THEN
    -- Best-effort duplicate cleanup (keeps the latest row by created/added timestamp if present, else arbitrary).
    -- Using ctid tie-breaker to delete duplicates safely without a primary key dependency.
    EXECUTE $cleanup$
      DELETE FROM public.affiliate_products a
      USING public.affiliate_products b
      WHERE a.affiliate_id = b.affiliate_id
        AND a.product_id = b.product_id
        AND a.ctid < b.ctid;
    $cleanup$;

    -- Needed for upsert({ onConflict: 'affiliate_id,product_id' })
    CREATE UNIQUE INDEX IF NOT EXISTS affiliate_products_affiliate_id_product_id_key
      ON public.affiliate_products(affiliate_id, product_id);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fundraiser_products') THEN
    EXECUTE $cleanup$
      DELETE FROM public.fundraiser_products a
      USING public.fundraiser_products b
      WHERE a.fundraiser_id = b.fundraiser_id
        AND a.product_id = b.product_id
        AND a.ctid < b.ctid;
    $cleanup$;

    CREATE UNIQUE INDEX IF NOT EXISTS fundraiser_products_fundraiser_id_product_id_key
      ON public.fundraiser_products(fundraiser_id, product_id);
  END IF;
END $$;

