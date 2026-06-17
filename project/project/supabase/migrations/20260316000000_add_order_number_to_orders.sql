alter table public.orders
  add column if not exists order_number text;

update public.orders
set order_number = 'BZO-' || to_char(coalesce(created_at, now()) at time zone 'utc', 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where order_number is null;

create unique index if not exists orders_order_number_key
  on public.orders (order_number)
  where order_number is not null;
