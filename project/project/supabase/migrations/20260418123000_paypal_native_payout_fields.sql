-- PayPal-native payout fields and request metadata.
-- Keep legacy Stripe-named columns during the transition so historical data and older reports remain readable.

ALTER TABLE public.orders
  ALTER COLUMN payment_provider SET DEFAULT 'PAYPAL';

UPDATE public.orders
SET payment_provider = 'PAYPAL'
WHERE coalesce(trim(payment_provider), '') = ''
  AND (
    nullif(trim(provider_order_id), '') IS NOT NULL
    OR nullif(trim(provider_capture_id), '') IS NOT NULL
  );

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS paypal_batch_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_item_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_destination_email TEXT;

CREATE INDEX IF NOT EXISTS idx_payouts_provider ON public.payouts(provider);
CREATE INDEX IF NOT EXISTS idx_payouts_paypal_batch_id ON public.payouts(paypal_batch_id) WHERE paypal_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payouts_paypal_item_id ON public.payouts(paypal_item_id) WHERE paypal_item_id IS NOT NULL;

UPDATE public.payouts
SET provider = CASE
  WHEN nullif(trim(coalesce(provider, '')), '') IS NOT NULL THEN provider
  WHEN nullif(trim(coalesce(paypal_batch_id, '')), '') IS NOT NULL THEN 'paypal'
  WHEN nullif(trim(coalesce(stripe_transfer_id, '')), '') IS NOT NULL THEN 'stripe'
  ELSE NULL
END
WHERE provider IS NULL;

ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS payout_provider TEXT,
  ADD COLUMN IF NOT EXISTS payout_destination_email TEXT;

CREATE INDEX IF NOT EXISTS idx_payout_requests_provider ON public.payout_requests(payout_provider);

UPDATE public.payout_requests
SET payout_provider = 'paypal'
WHERE payout_provider IS NULL;

UPDATE public.payout_requests pr
SET payout_destination_email = pa.paypal_email
FROM public.paypal_accounts pa
WHERE pr.user_id = pa.user_id
  AND pr.payout_destination_email IS NULL
  AND (
    (pr.role = 'seller' AND pa.role = 'SELLER')
    OR (pr.role = 'affiliate' AND pa.role = 'PARTNER')
  );

COMMENT ON COLUMN public.payouts.provider IS 'Payment rail used for the payout record, for example paypal.';
COMMENT ON COLUMN public.payouts.paypal_batch_id IS 'PayPal payout batch identifier for MassPay/Payouts API batches.';
COMMENT ON COLUMN public.payouts.paypal_item_id IS 'PayPal sender item id used within a payout batch.';
COMMENT ON COLUMN public.payout_requests.payout_provider IS 'Requested payout provider, currently paypal.';
COMMENT ON COLUMN public.payout_requests.payout_destination_email IS 'Destination email used for the payout request at submission time.';