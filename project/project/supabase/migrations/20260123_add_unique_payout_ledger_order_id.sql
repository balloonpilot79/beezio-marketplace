-- Prevent duplicate payout_ledger rows per order (idempotent)

CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_ledger_order_id
  ON public.payout_ledger(order_id)
  WHERE order_id IS NOT NULL;
