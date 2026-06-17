-- Enable authenticated users to view their own payout status/history (idempotent)

-- Grants (tables were previously REVOKE'd in the PayPal MVP migration)
GRANT SELECT ON TABLE public.payout_items TO authenticated;
GRANT SELECT ON TABLE public.payout_ledger TO authenticated;

-- payout_items: users can read items where they are the payee
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payout_items'
      AND policyname = 'users can read own payout items'
  ) THEN
    CREATE POLICY "users can read own payout items"
      ON public.payout_items
      FOR SELECT
      TO authenticated
      USING (
        payee_user_id IN (
          SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- payout_ledger: users can read ledgers where they are a seller/partner/influencer
ALTER TABLE public.payout_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payout_ledger'
      AND policyname = 'users can read own payout ledger'
  ) THEN
    CREATE POLICY "users can read own payout ledger"
      ON public.payout_ledger
      FOR SELECT
      TO authenticated
      USING (
        seller_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR partner_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
        OR influencer_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      );
  END IF;
END $$;
