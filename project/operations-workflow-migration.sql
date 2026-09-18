-- Beezio operational workflow migration
-- Run once in Supabase SQL Editor. Safe for an existing database.

create extension if not exists pgcrypto;

-- Orders need one stable number and delivery state visible to buyers and sellers.
alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_email text;
alter table public.orders add column if not exists payment_status text default 'pending';
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;

update public.orders
set order_number = 'BZ-' || upper(substr(replace(id::text, '-', ''), 1, 10))
where order_number is null;

create unique index if not exists orders_order_number_key on public.orders(order_number);
create index if not exists orders_customer_email_idx on public.orders(customer_email);
create index if not exists orders_tracking_idx on public.orders(tracking_number);

-- Snapshot the product and fee allocation on every line item. Existing columns are preserved.
alter table public.order_items add column if not exists product_title text;
alter table public.order_items add column if not exists image_url text;
alter table public.order_items add column if not exists price numeric(12,2);
alter table public.order_items add column if not exists seller_payout numeric(12,2) default 0;
alter table public.order_items add column if not exists affiliate_commission numeric(12,2) default 0;
alter table public.order_items add column if not exists influencer_commission numeric(12,2) default 0;
alter table public.order_items add column if not exists beezio_net numeric(12,2) default 0;
alter table public.order_items add column if not exists tracking_number text;
alter table public.order_items add column if not exists shipped_at timestamptz;

-- One canonical selection table for an affiliate/influencer store. It is deliberately
-- separate from product ownership: selecting a product never copies or deletes the seller's product.
create table if not exists public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  custom_title text,
  custom_description text,
  custom_link text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (affiliate_id, product_id)
);

alter table public.affiliate_products add column if not exists is_active boolean not null default true;
alter table public.affiliate_products add column if not exists custom_title text;
alter table public.affiliate_products add column if not exists custom_description text;
alter table public.affiliate_products add column if not exists custom_link text;
alter table public.affiliate_products add column if not exists updated_at timestamptz not null default now();
create unique index if not exists affiliate_products_owner_product_key on public.affiliate_products(affiliate_id, product_id);

create index if not exists affiliate_products_affiliate_idx on public.affiliate_products(affiliate_id, is_active);
create index if not exists affiliate_products_product_idx on public.affiliate_products(product_id);

-- Notification inbox: email delivery is separate, but the in-app record guarantees that
-- an order/shipment is never missed if an email is delayed.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  order_id uuid references public.orders(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- Explicit influencer attribution. An influencer is a promoter/recruiter; payouts are
-- recorded separately from the direct affiliate commission.
alter table public.profiles add column if not exists influencer_enabled boolean not null default false;
alter table public.profiles add column if not exists payout_email text;
alter table public.order_items add column if not exists influencer_id uuid references public.profiles(id) on delete set null;
alter table public.payouts add column if not exists payout_batch_id uuid;
alter table public.payouts add column if not exists available_at timestamptz;
alter table public.payouts add column if not exists payout_method text;

create table if not exists public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  scheduled_for date not null,
  status text not null default 'open' check (status in ('open','processing','paid','failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(period_start, period_end)
);

-- Helper used by the seller dashboard. A seller sees an order if at least one line is theirs.
create or replace function public.seller_can_manage_order(p_order_id uuid, p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.order_items oi
    where oi.order_id = p_order_id and oi.seller_id = p_profile_id
  );
$$;

alter table public.affiliate_products enable row level security;
alter table public.notifications enable row level security;
alter table public.payout_batches enable row level security;

drop policy if exists affiliate_products_owner_select on public.affiliate_products;
create policy affiliate_products_owner_select on public.affiliate_products for select to authenticated
  using (affiliate_id in (select id from public.profiles where user_id = auth.uid()) or
         exists (select 1 from public.profiles p where p.user_id = auth.uid() and (p.role = 'admin' or p.primary_role = 'admin')));
drop policy if exists affiliate_products_owner_write on public.affiliate_products;
create policy affiliate_products_owner_write on public.affiliate_products for all to authenticated
  using (affiliate_id in (select id from public.profiles where user_id = auth.uid()))
  with check (affiliate_id in (select id from public.profiles where user_id = auth.uid()));

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select on public.notifications for select to authenticated
  using (user_id in (select id from public.profiles where user_id = auth.uid()));
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications for update to authenticated
  using (user_id in (select id from public.profiles where user_id = auth.uid()));

-- Sellers may update fulfillment fields only for their own order lines.
drop policy if exists seller_update_fulfillment on public.orders;
create policy seller_update_fulfillment on public.orders for update to authenticated
  using (public.seller_can_manage_order(id, (select id from public.profiles where user_id = auth.uid())))
  with check (public.seller_can_manage_order(id, (select id from public.profiles where user_id = auth.uid())));

create or replace function public.set_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'BZ-' || upper(substr(replace(new.id::text, '-', ''), 1, 10));
  end if;
  return new;
end;
$$;
drop trigger if exists orders_set_order_number on public.orders;
create trigger orders_set_order_number before insert on public.orders for each row execute function public.set_order_number();

-- Keep old orders readable even when older clients only populated total_amount.
update public.orders set payment_status = case when status in ('paid','processing','shipped','delivered') then 'paid' else coalesce(payment_status,'pending') end where payment_status is null;

