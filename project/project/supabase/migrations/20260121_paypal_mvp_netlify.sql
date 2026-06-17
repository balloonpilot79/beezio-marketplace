-- PayPal MVP support tables for Netlify backend (idempotent)

-- 1) PayPal webhook event log (idempotency)
CREATE TABLE IF NOT EXISTS public.paypal_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT,
  resource_type TEXT,
  raw_json JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paypal_webhook_events_event_id ON public.paypal_webhook_events(event_id);

-- Security: webhook log should never be client-readable
ALTER TABLE public.paypal_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.paypal_webhook_events FROM anon, authenticated;

-- 2) Payout batches + items (tracks PayPal payouts API batches)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_batch_status') THEN
    CREATE TYPE payout_batch_status AS ENUM (
      'CREATED',
      'SUBMITTED',
      'PARTIAL',
      'PAID',
      'FAILED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_item_status') THEN
    CREATE TYPE payout_item_status AS ENUM (
      'CREATED',
      'SENT',
      'FAILED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('paypal','stripe')),
  status payout_batch_status NOT NULL DEFAULT 'CREATED',
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  item_count INT NOT NULL DEFAULT 0,
  provider_batch_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_provider_batch_id ON public.payout_batches(provider_batch_id);

-- Security: payout tracking tables are server/admin-only
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payout_batches FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_id UUID NOT NULL REFERENCES public.payout_batches(id) ON DELETE CASCADE,
  ledger_id UUID REFERENCES public.payout_ledger(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status payout_item_status NOT NULL DEFAULT 'CREATED',
  provider_item_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_items_batch ON public.payout_items(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_ledger ON public.payout_items(ledger_id);

ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payout_items FROM anon, authenticated;

-- Updated-at triggers (re-use helper if present)
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

DROP TRIGGER IF EXISTS trg_payout_batches_updated_at ON public.payout_batches;
CREATE TRIGGER trg_payout_batches_updated_at
  BEFORE UPDATE ON public.payout_batches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_payout_items_updated_at ON public.payout_items;
CREATE TRIGGER trg_payout_items_updated_at
  BEFORE UPDATE ON public.payout_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 3) Orders/Order items: PayPal provider ids + pricing fields (non-breaking additions)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subtotal_listing NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS total_charged NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_orders_provider_order_id ON public.orders(provider_order_id);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS seller_ask_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS partner_rate NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS influencer_rate NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS beezio_rate NUMERIC(10,6),
  ADD COLUMN IF NOT EXISTS computed_listing_price NUMERIC(10,2);
