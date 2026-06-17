-- BEEZIO LEDGER + PAYOUT SCHEMA (GREENFIELD BLUEPRINT)
--
-- WARNING:
-- - This file is a "fresh DB" blueprint intended for copy/paste into a new Postgres/Supabase project.
-- - The current Beezio repo already has an `orders` table and multiple payout-related tables.
-- - Do NOT run this wholesale against an existing Beezio database unless you are intentionally rebuilding schema.
-- - If VS Code shows lint/syntax errors, ensure the file is interpreted as PostgreSQL.
--
-- If you want to extend the existing Beezio schema instead, prefer adding additive migrations in `supabase/migrations/`.

-- 1) ENUMS (optional but recommended)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM (
      'OPEN',
      'FULFILLING',
      'DELIVERED',
      'DISPUTED',
      'REFUNDED',
      'CANCELED',
      'MATURED',
      'CLOSED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_line_type') THEN
    CREATE TYPE ledger_line_type AS ENUM (
      'GROSS_SALE',
      'PROCESSOR_FEE',
      'SALES_TAX',
      'SHIPPING_CHARGED',
      'COGS',
      'BEEZIO_PLATFORM_FEE',
      'SELLER_NET_PAYABLE',
      'AFFILIATE_COMMISSION_PAYABLE',
      'INFLUENCER_OVERRIDE_PAYABLE',
      'REFUND',
      'CHARGEBACK',
      'ADJUSTMENT'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payee_role') THEN
    CREATE TYPE payee_role AS ENUM ('SELLER','AFFILIATE','INFLUENCER','BEEZIO');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_batch_status') THEN
    CREATE TYPE payout_batch_status AS ENUM ('DRAFT','READY','SENT','PARTIAL','FAILED','CANCELED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_line_status') THEN
    CREATE TYPE payout_line_status AS ENUM ('QUEUED','SENT','PAID','FAILED','CANCELED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_processor') THEN
    CREATE TYPE payment_processor AS ENUM ('PAYPAL','STRIPE','MANUAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type') THEN
    CREATE TYPE fulfillment_type AS ENUM ('CJ','SELLER');
  END IF;
END $$;

-- 2) USERS / PAYOUT PROFILES
CREATE TABLE IF NOT EXISTS public.user_payout_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role payee_role not null,

  -- PayPal
  paypal_email text,

  -- Bank ACH (if you do bank payouts later)
  bank_routing_last4 text,
  bank_account_last4 text,
  bank_account_type text,

  -- Tax / compliance (minimal storage)
  tax_w9_status text default 'NOT_COLLECTED',
  tax_country text default 'US',
  tax_entity_type text,
  tax_last_verified_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_user_payout_profiles_user_id ON public.user_payout_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payout_profiles_role ON public.user_payout_profiles(role);

-- 3) ORDERS (HIGH LEVEL)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,

  buyer_user_id uuid,
  storefront_user_id uuid,
  product_id uuid,
  seller_user_id uuid,
  fulfillment fulfillment_type not null default 'CJ',

  processor payment_processor not null,
  processor_payment_id text,
  processor_charge_id text,

  currency text not null default 'USD',
  status order_status not null default 'OPEN',

  ordered_at timestamptz default now(),
  matured_at timestamptz,
  delivered_at timestamptz,
  refunded_at timestamptz,

  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_processor ON public.orders(processor);
CREATE INDEX IF NOT EXISTS idx_orders_seller_user_id ON public.orders(seller_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_storefront_user_id ON public.orders(storefront_user_id);

-- 4) LEDGER (ONE ORDER = MANY LINES)
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  line_type ledger_line_type not null,
  amount_cents bigint not null,
  currency text not null default 'USD',

  payee_user_id uuid,
  payee_role payee_role,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_order_id ON public.ledger_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_line_type ON public.ledger_entries(line_type);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_payee_user_id ON public.ledger_entries(payee_user_id);

-- 5) PAYOUT BATCHES + LINES
CREATE TABLE IF NOT EXISTS public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  processor payment_processor not null,
  status payout_batch_status not null default 'DRAFT',

  pay_period_start date not null,
  pay_period_end date not null,
  scheduled_pay_date date not null,

  created_by uuid,
  created_at timestamptz default now(),
  sent_at timestamptz,
  external_batch_id text,
  notes text
);

CREATE TABLE IF NOT EXISTS public.payout_lines (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references public.payout_batches(id) on delete cascade,

  payee_user_id uuid not null,
  payee_role payee_role not null,
  payout_method payment_processor not null,

  destination text,
  amount_cents bigint not null,
  currency text not null default 'USD',

  order_ids uuid[] not null default '{}'::uuid[],

  status payout_line_status not null default 'QUEUED',
  external_payout_id text,
  error text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_payout_lines_batch_id ON public.payout_lines(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_lines_payee_user_id ON public.payout_lines(payee_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_lines_status ON public.payout_lines(status);

-- 6) DAILY CASH “SAFE TO MOVE” SNAPSHOT
CREATE TABLE IF NOT EXISTS public.cash_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,

  processor payment_processor not null default 'PAYPAL',
  processor_balance_cents bigint not null default 0,

  reserve_tax_cents bigint not null default 0,
  reserve_pending_seller_cents bigint not null default 0,
  reserve_pending_affiliate_cents bigint not null default 0,
  reserve_pending_influencer_cents bigint not null default 0,

  safe_to_transfer_cents bigint not null default 0,

  created_at timestamptz default now()
);
