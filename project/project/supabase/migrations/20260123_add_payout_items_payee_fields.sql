-- Add payee identity fields to payout_items for safe de-dupe and retries (idempotent)

ALTER TABLE public.payout_items
  ADD COLUMN IF NOT EXISTS payee_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payee_role paypal_account_role;

CREATE INDEX IF NOT EXISTS idx_payout_items_payee_user_role
  ON public.payout_items(payee_user_id, payee_role);

-- Prevent duplicate active payout items per (ledger, payee).
-- Allow retry when an item previously FAILED.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_items_ledger_payee_active
  ON public.payout_items(ledger_id, payee_user_id, payee_role)
  WHERE ledger_id IS NOT NULL
    AND payee_user_id IS NOT NULL
    AND payee_role IS NOT NULL
    AND status IN ('CREATED', 'SENT');
