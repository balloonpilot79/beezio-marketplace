-- Ledger table for platform-only money buckets (tax escrow, purchasing reserve, profit).
-- Keeps payouts/distributions for end-users separate from internal allocations.

CREATE TABLE IF NOT EXISTS public.platform_financial_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id text,
  order_id uuid,
  transaction_id uuid,
  allocation_type text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pfa_pi ON public.platform_financial_allocations(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_pfa_order ON public.platform_financial_allocations(order_id);
CREATE INDEX IF NOT EXISTS idx_pfa_tx ON public.platform_financial_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pfa_type ON public.platform_financial_allocations(allocation_type);

-- Optional RLS hardening: keep table private unless explicitly granted.
ALTER TABLE public.platform_financial_allocations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Allow service_role full access (Edge Functions).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_financial_allocations'
      AND policyname = 'service role can access platform allocations'
  ) THEN
    CREATE POLICY "service role can access platform allocations"
      ON public.platform_financial_allocations
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

