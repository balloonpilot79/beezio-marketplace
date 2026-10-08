-- The same refund may be observed by both the admin handler and PayPal webhooks.
-- Use a canonical reversal key per original ledger entry, independent of event reason.
-- Repeated invocations must never produce duplicate negative accounting entries.
CREATE OR REPLACE FUNCTION public.record_order_money_ledger_reversal(
  p_order_id uuid,
  p_reason text DEFAULT 'refund',
  p_provider_capture_id text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO public.order_money_ledger (
    source_key, order_id, order_item_id, payee_type, payee_id,
    currency, gross_amount, net_amount, status, hold_until, payout_batch_id,
    provider, provider_order_id, provider_capture_id, metadata, paid_at
  )
  SELECT
    source_key || ':reversal:refund',
    order_id, order_item_id, payee_type, payee_id,
    currency, ROUND((-gross_amount)::numeric, 2),
    ROUND((-net_amount)::numeric, 2),
    'reversed', NULL, payout_batch_id,
    provider, provider_order_id,
    COALESCE(NULLIF(TRIM(p_provider_capture_id), ''), provider_capture_id),
    metadata || jsonb_build_object(
      'reversal_of', id,
      'reversal_reason', COALESCE(NULLIF(TRIM(p_reason), ''), 'refund')
    ),
    CASE WHEN status = 'paid' THEN now() ELSE NULL END
  FROM public.order_money_ledger
  WHERE order_id = p_order_id
    AND net_amount <> 0
    AND source_key NOT LIKE '%:reversal:%'
  ON CONFLICT (source_key) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.order_money_ledger
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('held', 'ready', 'failed', 'tracked', 'on_hold_dispute')
    AND source_key NOT LIKE '%:reversal:%';

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_order_money_ledger_reversal(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_money_ledger_reversal(uuid, text, text)
  TO service_role;