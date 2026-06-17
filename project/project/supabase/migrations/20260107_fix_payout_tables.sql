-- Fix payout tables and earnings schema to unblock onboarding + dashboards.
-- Safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public.user_earnings') IS NULL THEN
    CREATE TABLE public.user_earnings (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID,
      role TEXT NOT NULL,
      total_earned NUMERIC(10,2) DEFAULT 0,
      pending_payout NUMERIC(10,2) DEFAULT 0,
      paid_out NUMERIC(10,2) DEFAULT 0,
      current_balance NUMERIC(10,2) DEFAULT 0,
      held_balance NUMERIC(10,2) DEFAULT 0,
      last_payout_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, role)
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'role'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN role TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'total_earned'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN total_earned NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'pending_payout'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN pending_payout NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'paid_out'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN paid_out NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'current_balance'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN current_balance NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'held_balance'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN held_balance NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'last_payout_at'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN last_payout_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_earnings' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.user_earnings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'user_earnings_user_id_role_key'
    ) THEN
      ALTER TABLE public.user_earnings
        ADD CONSTRAINT user_earnings_user_id_role_key UNIQUE (user_id, role);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.payment_distributions') IS NULL THEN
    CREATE TABLE public.payment_distributions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      transaction_id UUID,
      order_id UUID,
      recipient_type TEXT NOT NULL,
      recipient_id UUID,
      amount NUMERIC(10,2) NOT NULL,
      percentage NUMERIC(5,2) DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      stripe_transfer_id TEXT,
      available_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      paid_at TIMESTAMPTZ
    );
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_distributions' AND column_name = 'order_id'
    ) THEN
      ALTER TABLE public.payment_distributions ADD COLUMN order_id UUID;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_distributions' AND column_name = 'available_at'
    ) THEN
      ALTER TABLE public.payment_distributions ADD COLUMN available_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'payment_distributions' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.payment_distributions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_distributions_recipient
  ON public.payment_distributions(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_payment_distributions_order_id
  ON public.payment_distributions(order_id);
CREATE INDEX IF NOT EXISTS idx_user_earnings_user_role
  ON public.user_earnings(user_id, role);

CREATE OR REPLACE FUNCTION public.update_user_earnings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_earnings (user_id, role, total_earned, pending_payout, current_balance)
  SELECT
    NEW.recipient_id,
    NEW.recipient_type,
    NEW.amount,
    CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END
  WHERE NEW.recipient_id IS NOT NULL
  ON CONFLICT (user_id, role) DO UPDATE SET
    total_earned = public.user_earnings.total_earned + NEW.amount,
    pending_payout = public.user_earnings.pending_payout + CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    current_balance = public.user_earnings.current_balance + CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_earnings ON public.payment_distributions;
CREATE TRIGGER trigger_update_user_earnings
  AFTER INSERT OR UPDATE ON public.payment_distributions
  FOR EACH ROW EXECUTE FUNCTION public.update_user_earnings();

ALTER TABLE public.payment_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_distributions_select_own_or_admin" ON public.payment_distributions;
CREATE POLICY "payment_distributions_select_own_or_admin"
  ON public.payment_distributions
  FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "user_earnings_select_own_or_admin" ON public.user_earnings;
CREATE POLICY "user_earnings_select_own_or_admin"
  ON public.user_earnings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
