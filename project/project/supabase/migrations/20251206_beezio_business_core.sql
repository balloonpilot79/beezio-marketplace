-- Beezio core business schema alignment
-- Adds storefronts, storefront_products, affiliate_referrals, payouts, and missing order/order_items columns
-- Safe to run repeatedly; uses IF NOT EXISTS guards.

-- UUID support
create extension if not exists "pgcrypto";

-- storefront type enum
do $$ begin
  create type storefront_type as enum ('seller', 'affiliate', 'fundraiser');
exception when duplicate_object then null; end $$;

-- payout role enum (lightweight, stored as text with check)
-- Using CHECK instead of a new enum to avoid conflicts with prior deployments.

-- storefronts table
create table if not exists storefronts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  type storefront_type not null default 'seller',
  name text not null,
  slug text unique,
  custom_domain text,
  logo_url text,
  theme_settings jsonb default '{}'::jsonb,
  fundraiser_percent numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_storefronts_owner on storefronts(owner_id);
create unique index if not exists idx_storefronts_slug on storefronts(slug);

-- storefront_products join (affiliate/fundraiser curation and optional seller mapping)
create table if not exists storefront_products (
  id uuid primary key default gen_random_uuid(),
  storefront_id uuid not null references storefronts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  position integer default 0,
  created_at timestamptz default now()
);

create unique index if not exists idx_storefront_products_unique on storefront_products(storefront_id, product_id);
create index if not exists idx_storefront_products_position on storefront_products(storefront_id, position);

-- affiliate referrals (who recruited whom)
create table if not exists affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_affiliate_id uuid references profiles(id) on delete cascade,
  referred_affiliate_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  constraint affiliate_referrals_unique_pair unique (referrer_affiliate_id, referred_affiliate_id)
);

-- If table already existed with missing columns, add them now (idempotent)
alter table affiliate_referrals
  add column if not exists referrer_affiliate_id uuid references profiles(id) on delete cascade,
  add column if not exists referred_affiliate_id uuid references profiles(id) on delete cascade;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'affiliate_referrals_unique_pair'
  ) then
    alter table affiliate_referrals
      add constraint affiliate_referrals_unique_pair unique (referrer_affiliate_id, referred_affiliate_id);
  end if;
end $$;

create index if not exists idx_affiliate_referrals_referrer on affiliate_referrals(referrer_affiliate_id);
create index if not exists idx_affiliate_referrals_referred on affiliate_referrals(referred_affiliate_id);

-- payouts log (records who should receive what per order)
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  beneficiary_id uuid references profiles(id) on delete cascade,
  role text not null check (role in ('seller','affiliate','referral_affiliate','fundraiser','beezio','stripe')),
  amount numeric not null,
  description text,
  created_at timestamptz default now()
);

create index if not exists idx_payouts_order on payouts(order_id);
create index if not exists idx_payouts_beneficiary on payouts(beneficiary_id);
create index if not exists idx_payouts_role on payouts(role);

-- Orders: attach storefront + affiliate context and baked-in pricing fields
alter table orders
  add column if not exists storefront_id uuid references storefronts(id) on delete set null,
  add column if not exists affiliate_id uuid references profiles(id) on delete set null,
  add column if not exists subtotal_amount numeric,
  add column if not exists tax_amount numeric,
  add column if not exists shipping_amount numeric,
  add column if not exists total_amount numeric,
  add column if not exists platform_percent_at_purchase numeric,
  add column if not exists fundraiser_percent_at_purchase numeric,
  add column if not exists affiliate_commission_percent_at_purchase numeric;

create index if not exists idx_orders_storefront on orders(storefront_id);
create index if not exists idx_orders_affiliate on orders(affiliate_id);

-- Order items: capture per-unit economics at purchase time
alter table order_items
  add column if not exists final_sale_price_per_unit numeric,
  add column if not exists seller_ask_price_per_unit numeric,
  add column if not exists affiliate_commission_percent_at_purchase numeric,
  add column if not exists platform_percent_at_purchase numeric,
  add column if not exists fundraiser_percent_at_purchase numeric,
  add column if not exists created_at timestamptz default now();

-- Profiles: ensure referral_code column exists (idempotent if already applied)
alter table profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by_affiliate_id uuid references profiles(id);

create index if not exists idx_profiles_referred_by on profiles(referred_by_affiliate_id);
