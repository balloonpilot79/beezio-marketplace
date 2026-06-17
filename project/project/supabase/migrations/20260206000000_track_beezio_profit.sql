-- Track Beezio platform fee vs net profit + CJ markup profit (idempotent)

ALTER TABLE public.payout_ledger
  ADD COLUMN IF NOT EXISTS beezio_fee_gross NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS beezio_fee_net NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS beezio_profit NUMERIC(10,2);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS platform_fee_gross NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS platform_fee_net NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cj_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS beezio_cj_profit NUMERIC(10,2);
