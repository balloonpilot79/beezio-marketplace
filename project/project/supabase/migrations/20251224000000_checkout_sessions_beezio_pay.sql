-- Beezio Pay v1 (Checkout Sessions + ledgered payouts)
-- Adds sellers, checkout_intents, earnings_ledger, and order columns needed for Stripe Checkout Sessions.

create extension if not exists "pgcrypto";

-- A) sellers
create table if not exists public.sellers (
  id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text,
  affiliate_rate_default numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_sellers_stripe_account_id on public.sellers(stripe_account_id);

alter table public.sellers enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'sellers'
      and policyname = 'service role can access sellers'
  ) then
    create policy "service role can access sellers"
      on public.sellers
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- B) checkout_intents
create table if not exists public.checkout_intents (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  affiliate_id uuid references public.profiles(id) on delete set null,
  referrer_id uuid references public.profiles(id) on delete set null,
  fundraiser_id uuid references public.profiles(id) on delete set null,
  store_id uuid references public.storefronts(id) on delete set null,
  items_subtotal numeric(10,2) not null default 0,
  shipping_amount numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  currency text not null default 'USD',
  split_json jsonb not null default '{}'::jsonb,
  status text not null default 'created' check (status in ('created','completed','failed')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkout_intents_seller on public.checkout_intents(seller_id);
create index if not exists idx_checkout_intents_affiliate on public.checkout_intents(affiliate_id);
create index if not exists idx_checkout_intents_referrer on public.checkout_intents(referrer_id);
create index if not exists idx_checkout_intents_fundraiser on public.checkout_intents(fundraiser_id);
create index if not exists idx_checkout_intents_store on public.checkout_intents(store_id);
create unique index if not exists idx_checkout_intents_stripe_session_id on public.checkout_intents(stripe_session_id) where stripe_session_id is not null;

alter table public.checkout_intents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'checkout_intents'
      and policyname = 'service role can access checkout intents'
  ) then
    create policy "service role can access checkout intents"
      on public.checkout_intents
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- C) earnings_ledger
create table if not exists public.earnings_ledger (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('affiliate','referrer','tax')),
  seller_id uuid references public.profiles(id) on delete set null,
  affiliate_id uuid references public.profiles(id) on delete set null,
  referrer_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  checkout_intent_id uuid not null references public.checkout_intents(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending','paid','void')),
  created_at timestamptz not null default now()
);

create index if not exists idx_earnings_ledger_checkout_intent on public.earnings_ledger(checkout_intent_id);
create index if not exists idx_earnings_ledger_type on public.earnings_ledger(type);
create index if not exists idx_earnings_ledger_affiliate on public.earnings_ledger(affiliate_id);
create index if not exists idx_earnings_ledger_referrer on public.earnings_ledger(referrer_id);
create index if not exists idx_earnings_ledger_order on public.earnings_ledger(order_id);

create unique index if not exists uq_earnings_ledger_tax_per_checkout
  on public.earnings_ledger(checkout_intent_id, type)
  where type = 'tax';

create unique index if not exists uq_earnings_ledger_affiliate_per_checkout
  on public.earnings_ledger(checkout_intent_id, type, affiliate_id)
  where type = 'affiliate' and affiliate_id is not null;

create unique index if not exists uq_earnings_ledger_referrer_per_checkout
  on public.earnings_ledger(checkout_intent_id, type, referrer_id)
  where type = 'referrer' and referrer_id is not null;

alter table public.earnings_ledger enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'earnings_ledger'
      and policyname = 'service role can access earnings ledger'
  ) then
    create policy "service role can access earnings ledger"
      on public.earnings_ledger
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- D) orders (adapt)
alter table public.orders
  add column if not exists seller_id uuid references public.profiles(id) on delete set null,
  add column if not exists buyer_id uuid references public.profiles(id) on delete set null,
  add column if not exists checkout_intent_id uuid references public.checkout_intents(id) on delete set null,
  add column if not exists items_subtotal numeric(10,2),
  add column if not exists shipping_amount numeric(10,2),
  add column if not exists tax_amount numeric(10,2),
  add column if not exists stripe_session_id text;

create unique index if not exists uq_orders_checkout_intent_id
  on public.orders(checkout_intent_id)
  where checkout_intent_id is not null;

create index if not exists idx_orders_seller_id on public.orders(seller_id);
create index if not exists idx_orders_stripe_session_id on public.orders(stripe_session_id);

-- Ensure order_items has a `price` column (some UI expects it).
alter table public.order_items
  add column if not exists price numeric(10,2);

