-- Beezio Stripe Bible v1
-- - Adds deterministic fee breakdown fields to checkout_intents + orders
-- - Adds Stripe webhook idempotency table (stripe_events)
-- - Adds Stripe transfer ledger table (stripe_transfers)
-- Safe to run multiple times.

create extension if not exists "pgcrypto";

-- 0) Ensure core finance tables exist (some installs may not have run older payment migrations).
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  amount_total_cents bigint,
  total_amount numeric(10,2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1) checkout_intents: deterministic cents breakdown
alter table if exists public.checkout_intents
  add column if not exists split_version text not null default 'BEEZIO_SPLIT_V1',
  add column if not exists product_subtotal_cents bigint,
  add column if not exists affiliate_rate_bps integer,
  add column if not exists affiliate_fee_cents bigint,
  add column if not exists beezio_fee_cents bigint,
  add column if not exists ref_or_fundraiser_fee_cents bigint,
  add column if not exists shipping_cents bigint,
  add column if not exists tax_cents bigint,
  add column if not exists processing_fee_cents bigint,
  add column if not exists seller_transfer_cents bigint,
  add column if not exists total_cents bigint,
  add column if not exists has_referral boolean not null default false,
  add column if not exists is_fundraiser boolean not null default false;

create index if not exists idx_checkout_intents_stripe_payment_intent_id
  on public.checkout_intents(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- 2) orders: persist breakdown for UI/admin/audit
alter table if exists public.orders
  add column if not exists affiliate_fee_amount numeric(10,2),
  add column if not exists beezio_fee_amount numeric(10,2),
  add column if not exists ref_or_fundraiser_fee_amount numeric(10,2),
  add column if not exists processing_fee_amount numeric(10,2),
  add column if not exists stripe_charge_id text;

create index if not exists idx_orders_stripe_charge_id
  on public.orders(stripe_charge_id)
  where stripe_charge_id is not null;

-- 3) transactions: store charge + cents for canonical reconciliation
alter table if exists public.transactions
  add column if not exists stripe_charge_id text,
  add column if not exists amount_total_cents bigint;

do $$
begin
  if to_regclass('public.transactions') is not null then
    create index if not exists idx_transactions_stripe_charge_id
      on public.transactions(stripe_charge_id)
      where stripe_charge_id is not null;
  end if;
end $$;

-- 4) Stripe webhook idempotency table
create table if not exists public.stripe_events (
  stripe_event_id text primary key,
  type text not null,
  status text not null default 'processed',
  checkout_intent_id uuid references public.checkout_intents(id) on delete set null,
  payment_intent_id text,
  error text,
  raw jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists idx_stripe_events_type on public.stripe_events(type);
create index if not exists idx_stripe_events_payment_intent_id
  on public.stripe_events(payment_intent_id)
  where payment_intent_id is not null;

alter table public.stripe_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stripe_events'
      and policyname = 'service role can access stripe events'
  ) then
    create policy "service role can access stripe events"
      on public.stripe_events
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- 5) Stripe transfer ledger (Connect transfers created per charge)
create table if not exists public.stripe_transfers (
  id uuid primary key default gen_random_uuid(),
  stripe_transfer_id text unique,
  checkout_intent_id uuid references public.checkout_intents(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  payment_intent_id text,
  charge_id text,
  destination_user_id uuid references public.profiles(id) on delete set null,
  destination_stripe_account_id text,
  amount_cents bigint not null,
  currency text not null default 'USD',
  transfer_type text not null check (transfer_type in ('seller','affiliate','referrer','fundraiser')),
  status text not null default 'created' check (status in ('created','updated','reversed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stripe_transfers_checkout_intent_id on public.stripe_transfers(checkout_intent_id);
create index if not exists idx_stripe_transfers_order_id on public.stripe_transfers(order_id);
create index if not exists idx_stripe_transfers_payment_intent_id
  on public.stripe_transfers(payment_intent_id)
  where payment_intent_id is not null;

alter table public.stripe_transfers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'stripe_transfers'
      and policyname = 'service role can access stripe transfers'
  ) then
    create policy "service role can access stripe transfers"
      on public.stripe_transfers
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_stripe_transfers_updated_at on public.stripe_transfers;
create trigger trg_stripe_transfers_updated_at
before update on public.stripe_transfers
for each row execute function public.set_updated_at();
