alter table public.orders
  add column if not exists referrer_id uuid references public.profiles(id) on delete set null,
  add column if not exists store_id uuid references public.storefronts(id) on delete set null,
  add column if not exists source text,
  add column if not exists campaign text;

create index if not exists idx_orders_referrer_id on public.orders(referrer_id);
create index if not exists idx_orders_store_id on public.orders(store_id);

alter table public.order_items
  add column if not exists product_title text;

