alter table public.orders
  add column if not exists payment_status text;

alter table public.orders
  alter column payment_status set default 'pending';

update public.orders
set payment_status = case
  when lower(coalesce(status::text, '')) = 'completed' then 'paid'
  when lower(coalesce(status::text, '')) like '%refund%' then 'refunded'
  when lower(coalesce(status::text, '')) in ('failed', 'canceled', 'cancelled') then 'failed'
  else coalesce(nullif(payment_status, ''), 'pending')
end
where payment_status is null
   or btrim(payment_status) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('pending', 'paid', 'failed', 'refunded'));
  end if;
end $$;
