-- Complaint alerts and accurate reversal of payouts already frozen for a dispute.
-- All notifications remain server-side; recipients do not gain access to unrelated order data.

ALTER TABLE public.email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_notification_type_check;
ALTER TABLE public.email_notifications
  ADD CONSTRAINT email_notifications_notification_type_check
  CHECK (notification_type IN (
    'order_confirmation', 'shipping_confirmation', 'delivery_update', 'commission_paid',
    'dispute_opened', 'dispute_message', 'dispute_resolved'
  ));

ALTER TABLE public.email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_recipient_type_check;
ALTER TABLE public.email_notifications
  ADD CONSTRAINT email_notifications_recipient_type_check
  CHECK (recipient_type IN ('buyer', 'seller', 'affiliate', 'influencer', 'admin'));

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
    source_key || ':reversal:' || COALESCE(NULLIF(TRIM(p_reason), ''), 'refund'),
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

  -- Crucial: cancel original entries frozen while dispute was open.
  -- Otherwise negative reversal rows exist but the original positive holds remain.
  UPDATE public.order_money_ledger
  SET status = 'cancelled', updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('held', 'ready', 'failed', 'tracked', 'on_hold_dispute')
    AND source_key NOT LIKE '%:reversal:%';

  RETURN v_count;
END;
$function$;

-- This privileged ledger operation is only for server-side service-role calls.
REVOKE ALL ON FUNCTION public.record_order_money_ledger_reversal(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_money_ledger_reversal(uuid, text, text)
  TO service_role;
