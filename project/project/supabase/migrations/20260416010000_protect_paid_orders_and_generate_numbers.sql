alter table public.orders
  add column if not exists order_number text;

alter table public.orders
  alter column order_number set default
    (
      'BZO-' ||
      to_char(timezone('utc', now()), 'YYYYMMDD') ||
      '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    );

update public.orders
set order_number =
  'BZO-' ||
  to_char(coalesce(created_at, now()) at time zone 'utc', 'YYYYMMDD') ||
  '-' ||
  upper(substr(replace(id::text, '-', ''), 1, 8))
where nullif(trim(coalesce(order_number, '')), '') is null;

create unique index if not exists orders_order_number_key
  on public.orders (order_number)
  where order_number is not null;

alter table public.orders
  alter column order_number set not null;

drop rule if exists orders_prevent_paid_delete on public.orders;

create rule orders_prevent_paid_delete as
on delete to public.orders
where (
  old.paid_at is not null
  or lower(coalesce(old.status::text, '')) in ('paid', 'completed', 'processing', 'shipped', 'delivered', 'refunded')
)
do instead nothing;
