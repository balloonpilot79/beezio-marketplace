create table if not exists public.cj_fulfillment_settings (
  id integer primary key default 1 check (id = 1),
  sandbox_required boolean not null default true,
  sandbox_verified boolean not null default false,
  auto_pay_enabled boolean not null default false,
  min_balance_reserve numeric(12,2) not null default 50,
  max_auto_pay_order numeric(12,2) not null default 250,
  max_cost_increase_pct numeric(8,2) not null default 5,
  updated_at timestamptz not null default now()
);

alter table public.cj_fulfillment_settings enable row level security;
revoke all on public.cj_fulfillment_settings from anon, authenticated;

insert into public.cj_fulfillment_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.cj_sandbox_test_state (
  id integer primary key default 1 check (id = 1),
  status text not null default 'pending',
  attempt_count integer not null default 0,
  product_id uuid,
  product_variant_id uuid,
  cj_product_id text,
  cj_vid text,
  cj_order_id text,
  cj_order_number text,
  simulated_tracking_number text,
  last_error text,
  last_result jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  passed_at timestamptz,
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.cj_sandbox_test_state enable row level security;
revoke all on public.cj_sandbox_test_state from anon, authenticated;

insert into public.cj_sandbox_test_state (id)
values (1)
on conflict (id) do nothing;

alter table public.cj_orders
  add column if not exists cj_pay_id text,
  add column if not exists auto_pay_attempt_count integer not null default 0,
  add column if not exists auto_pay_error text,
  add column if not exists auto_paid_at timestamptz,
  add column if not exists auto_pay_decision jsonb not null default '{}'::jsonb;

create index if not exists cj_orders_autopay_queue_idx
  on public.cj_orders (cj_status, next_attempt_at)
  where cj_status = 'unpaid';
