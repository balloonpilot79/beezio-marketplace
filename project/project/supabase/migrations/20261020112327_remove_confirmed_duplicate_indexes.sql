-- Remove only redundant standalone indexes; retain uniqueness constraints.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
DO $$
DECLARE pair record; drop_def jsonb; keep_def jsonb;
BEGIN
 FOR pair IN SELECT * FROM (VALUES
 ('affiliate_products_owner_product_key','affiliate_products_affiliate_id_product_id_key'),
 ('idx_orders_user','idx_orders_user_id'),
 ('idx_payout_batches_provider_batch_id','payout_batches_provider_batch_idx'),
 ('payout_ledger_ready_pay_idx','idx_payout_ledger_status_release'),
 ('idx_storefront_products_unique','storefront_products_storefront_product_key'),
 ('idx_storefronts_slug','storefronts_slug_key')
 ) AS pairs(drop_name,keep_name) LOOP
  SELECT to_jsonb(i)-'indexrelid' INTO drop_def FROM pg_index i
    WHERE i.indexrelid=to_regclass(format('public.%I',pair.drop_name));
  SELECT to_jsonb(i)-'indexrelid' INTO keep_def FROM pg_index i
    WHERE i.indexrelid=to_regclass(format('public.%I',pair.keep_name));
  IF drop_def IS NULL OR keep_def IS NULL OR drop_def IS DISTINCT FROM keep_def
     OR (keep_def->>'indisvalid')::boolean IS NOT TRUE
     OR (drop_def->>'indisreplident')::boolean IS TRUE
     OR EXISTS(SELECT 1 FROM pg_constraint WHERE conindid=to_regclass(format('public.%I',pair.drop_name)))
     OR EXISTS(SELECT 1 FROM pg_depend WHERE refclassid='pg_class'::regclass AND refobjid=to_regclass(format('public.%I',pair.drop_name))) THEN
    RAISE EXCEPTION 'Index pair changed or is not safe to deduplicate: %',pair.drop_name;
  END IF;
  EXECUTE format('DROP INDEX public.%I',pair.drop_name);
 END LOOP;
END $$;

