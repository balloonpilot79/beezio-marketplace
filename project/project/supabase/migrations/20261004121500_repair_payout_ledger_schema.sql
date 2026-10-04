-- Columns required by record_paypal_order_finalization, missing in production.
ALTER TABLE public.payout_ledger
  ADD COLUMN IF NOT EXISTS beezio_fee_gross numeric(10,2),
  ADD COLUMN IF NOT EXISTS beezio_fee_net numeric(10,2),
  ADD COLUMN IF NOT EXISTS platform_fee_gross numeric(10,2),
  ADD COLUMN IF NOT EXISTS platform_fee_net numeric(10,2),
  ADD COLUMN IF NOT EXISTS beezio_profit numeric(10,2);

-- Finalization uses ON CONFLICT(order_id). Preserve one aggregate per order.
CREATE UNIQUE INDEX IF NOT EXISTS payout_ledger_order_id_unique ON public.payout_ledger(order_id);
