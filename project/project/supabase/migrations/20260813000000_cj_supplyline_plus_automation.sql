-- SupplyLine Plus / CJ automation contract.
-- Exact supplier identifiers and raw payloads live in private server tables.

alter table public.product_variants
  add column if not exists source text,
  add column if not exists source_platform text,
  add column if not exists cj_vid text,
  add column if not exists cj_variant_sku text,
  add column if not exists cj_variant_code text,
  add column if not exists cj_sku text,
  add column if not exists cj_option_summary text,
  add column if not exists supplier_variant_ref text,
  add column if not exists external_inventory_key text,
  add column if not exists variant_display_sku text,
  add column if not exists searchable_codes text[] not null default '{}'::text[],
  add column if not exists is_orderable boolean not null default true,
  add column if not exists order_reference_type text not null default 'none',
  add column if not exists raw_variant_payload_json jsonb not null default '{}'::jsonb,
  add column if not exists import_status text not null default 'ready',
  add column if not exists external_product_id text,
  add column if not exists external_variant_id text,
  add column if not exists title text,
  add column if not exists inventory_source text,
  add column if not exists external_data jsonb not null default '{}'::jsonb,
  add column if not exists supplier_cost_amount numeric not null default 0,
  add column if not exists seller_markup_amount numeric not null default 0,
  add column if not exists seller_payout_amount numeric not null default 0,
  add column if not exists affiliate_payout_amount numeric not null default 0,
  add column if not exists shipping_reserve_amount numeric not null default 0,
  add column if not exists calculated_customer_price numeric not null default 0,
  add column if not exists cj_freight_method text,
  add column if not exists cj_freight_origin_country text,
  add column if not exists cj_freight_destination_country text,
  add column if not exists cj_freight_quoted_at timestamptz,
  add column if not exists cj_price_verified_at timestamptz;

alter table public.product_variants
  alter column inventory drop not null,
  alter column weight_oz type numeric using weight_oz::numeric;

create unique index if not exists product_variants_cj_vid_unique
  on public.product_variants (cj_vid)
  where cj_vid is not null;
create index if not exists product_variants_source_platform_idx
  on public.product_variants (source_platform);

alter table public.orders
  add column if not exists cj_shipping_quote jsonb,
  add column if not exists cj_origin_country_code text,
  add column if not exists cj_shipping_quote_at timestamptz;

create table if not exists public.cj_product_mappings (
  id uuid primary key default gen_random_uuid(),
  beezio_product_id uuid not null references public.products(id) on delete cascade,
  cj_product_id text not null,
  cj_product_sku text,
  cj_variant_id text,
  cj_cost numeric not null default 0,
  markup_percent numeric not null default 0,
  affiliate_commission_percent numeric not null default 0,
  price_breakdown jsonb not null default '{}'::jsonb,
  last_synced timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cj_product_mappings_supplier_variant_key
  on public.cj_product_mappings (cj_product_id, cj_variant_id);
create index if not exists cj_product_mappings_beezio_product_idx
  on public.cj_product_mappings (beezio_product_id);

create table if not exists public.cj_variant_mappings (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null unique references public.product_variants(id) on delete cascade,
  beezio_product_id uuid not null references public.products(id) on delete cascade,
  cj_product_id text not null,
  cj_vid text not null unique,
  cj_variant_sku text,
  supplier_cost_amount numeric not null check (supplier_cost_amount >= 0),
  origin_country_code text not null default 'CN',
  freight_method text,
  freight_cost_amount numeric not null default 0 check (freight_cost_amount >= 0),
  freight_destination_country text not null default 'US',
  freight_quoted_at timestamptz,
  price_verified_at timestamptz,
  raw_supplier_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cj_variant_mappings_product_idx
  on public.cj_variant_mappings (beezio_product_id);

create table if not exists public.cj_orders (
  id uuid primary key default gen_random_uuid(),
  beezio_order_id uuid not null unique references public.orders(id) on delete cascade,
  cj_order_number text not null unique,
  cj_order_id text unique,
  shipment_order_id text,
  cj_status text not null default 'queued',
  cj_pay_url text,
  cj_tracking_number text,
  cj_tracking_url text,
  cj_logistic_name text,
  cj_origin_country_code text,
  cj_product_cost numeric not null default 0,
  cj_shipping_cost numeric not null default 0,
  cj_cost numeric not null default 0,
  actual_payment numeric,
  order_data jsonb not null default '{}'::jsonb,
  response_data jsonb not null default '{}'::jsonb,
  error_message text,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cj_orders_status_retry_idx
  on public.cj_orders (cj_status, next_attempt_at);
create index if not exists cj_orders_tracking_idx
  on public.cj_orders (cj_tracking_number)
  where cj_tracking_number is not null;

create table if not exists public.cj_webhook_events (
  id uuid primary key default gen_random_uuid(),
  message_id text not null unique,
  event_type text,
  message_type text,
  payload jsonb not null,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.cj_tokens (
  id integer primary key default 1 check (id = 1),
  access_token text not null,
  open_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.cj_product_mappings enable row level security;
alter table public.cj_variant_mappings enable row level security;
alter table public.cj_orders enable row level security;
alter table public.cj_webhook_events enable row level security;
alter table public.cj_tokens enable row level security;

revoke all on public.cj_product_mappings from anon, authenticated;
revoke all on public.cj_variant_mappings from anon, authenticated;
revoke all on public.cj_webhook_events from anon, authenticated;
revoke all on public.cj_tokens from anon, authenticated;
revoke all on public.cj_orders from anon, authenticated;

drop policy if exists cj_orders_participant_read on public.cj_orders;

comment on table public.cj_variant_mappings is
  'Private exact SupplyLine Plus fulfillment mapping. Never expose to shopper APIs.';
comment on column public.cj_orders.cj_pay_url is
  'Admin-only CJ payment link for orders created with payType=3.';
