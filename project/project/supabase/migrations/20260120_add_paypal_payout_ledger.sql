-- PayPal payout ledger + partner/influencer fields (idempotent additions)

-- Enums (safe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_ledger_status') THEN
    CREATE TYPE payout_ledger_status AS ENUM (
      'PENDING_HOLD',
      'READY_TO_PAY',
      'PAID',
      'ON_HOLD_DISPUTE',
      'CANCELED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paypal_account_role') THEN
    CREATE TYPE paypal_account_role AS ENUM ('SELLER', 'PARTNER', 'INFLUENCER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_dispute_status') THEN
    CREATE TYPE order_dispute_status AS ENUM ('NONE', 'OPEN', 'WON', 'LOST');
  END IF;
END $$;

-- Orders: PayPal routing + disputes + shipping fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS dispute_status order_dispute_status DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS carrier TEXT,
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS influencer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider ON public.orders(payment_provider);
CREATE INDEX IF NOT EXISTS idx_orders_dispute_status ON public.orders(dispute_status);

ALTER TABLE public.orders
  ALTER COLUMN payment_provider SET DEFAULT 'STRIPE';

-- Profiles: partner recruited by influencer
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recruited_by_influencer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Products/Sellers: partner commission controls
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS partner_commission_percent NUMERIC;

ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS default_partner_commission_percent NUMERIC;

-- PayPal accounts
CREATE TABLE IF NOT EXISTS public.paypal_accounts (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role paypal_account_role NOT NULL,
  paypal_email TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_paypal_accounts_email ON public.paypal_accounts(paypal_email);

-- Payout ledger for PayPal holds and batch payouts
CREATE TABLE IF NOT EXISTS public.payout_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  influencer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  gross_amount NUMERIC(10,2) NOT NULL,
  seller_earnings NUMERIC(10,2) NOT NULL,
  partner_earnings NUMERIC(10,2) NOT NULL,
  influencer_earnings NUMERIC(10,2) NOT NULL,
  beezio_fee NUMERIC(10,2) NOT NULL,
  paypal_fee_estimate NUMERIC(10,2),
  status payout_ledger_status NOT NULL DEFAULT 'PENDING_HOLD',
  hold_release_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  paypal_payout_batch_id TEXT,
  paypal_payout_item_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_ledger_status_release ON public.payout_ledger(status, hold_release_at);
CREATE INDEX IF NOT EXISTS idx_payout_ledger_seller ON public.payout_ledger(seller_id);
CREATE INDEX IF NOT EXISTS idx_payout_ledger_partner ON public.payout_ledger(partner_id);
CREATE INDEX IF NOT EXISTS idx_payout_ledger_influencer ON public.payout_ledger(influencer_id);

-- Updated-at trigger helper (safe)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $do$;

DROP TRIGGER IF EXISTS trg_paypal_accounts_updated_at ON public.paypal_accounts;
CREATE TRIGGER trg_paypal_accounts_updated_at
  BEFORE UPDATE ON public.paypal_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_payout_ledger_updated_at ON public.payout_ledger;
CREATE TRIGGER trg_payout_ledger_updated_at
  BEFORE UPDATE ON public.payout_ledger
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- RLS (service role full access; users can manage their own PayPal account)
ALTER TABLE public.paypal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'paypal_accounts' AND policyname = 'service role can access paypal accounts'
  ) THEN
    CREATE POLICY "service role can access paypal accounts"
      ON public.paypal_accounts
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'paypal_accounts' AND policyname = 'users manage own paypal accounts'
  ) THEN
    CREATE POLICY "users manage own paypal accounts"
      ON public.paypal_accounts
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'payout_ledger' AND policyname = 'service role can access payout ledger'
  ) THEN
    CREATE POLICY "service role can access payout ledger"
      ON public.payout_ledger
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
