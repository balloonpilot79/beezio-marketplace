-- Itemized order money trail.
-- This is the accounting mirror for every paid order: seller, affiliate,
-- influencer, Beezio, tax, shipping, and processor-fee obligations.

create table if not exists public.order_money_ledger (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  payee_type text not null check (
    payee_type in (
      'seller',
      'affiliate',
      'influencer',
      'beezio',
      'tax',
      'shipping',
      'processor_fee'
    )
  ),
  payee_id uuid references public.profiles(id) on delete set null,
  currency text not null default 'USD',
  gross_amount numeric(10,2) not null default 0,
  net_amount numeric(10,2) not null default 0,
  status text not null default 'held' check (
    status in ('held', 'ready', 'paid', 'failed', 'cancelled', 'tracked', 'reversed', 'on_hold_dispute')
  ),
  hold_until timestamptz,
  payout_batch_id uuid references public.payout_batches(id) on delete set null,
  provider text not null default 'paypal',
  provider_order_id text,
  provider_capture_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.order_money_ledger
  drop constraint if exists order_money_ledger_status_check;

alter table public.order_money_ledger
  add constraint order_money_ledger_status_check
  check (status in ('held', 'ready', 'paid', 'failed', 'cancelled', 'tracked', 'reversed', 'on_hold_dispute'));

alter table public.order_items
  add column if not exists fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled')),
  add column if not exists shipping_carrier text,
  add column if not exists tracking_number text,
  add column if not exists fulfilled_at timestamptz;

alter table public.payout_batches
  add column if not exists payout_date date,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.payout_items
  add column if not exists order_money_ledger_id uuid references public.order_money_ledger(id) on delete set null;

create index if not exists order_money_ledger_order_idx
  on public.order_money_ledger(order_id);

create index if not exists order_money_ledger_item_idx
  on public.order_money_ledger(order_item_id);

create index if not exists order_money_ledger_payee_idx
  on public.order_money_ledger(payee_type, payee_id, status, hold_until);

create index if not exists order_money_ledger_provider_capture_idx
  on public.order_money_ledger(provider_capture_id)
  where provider_capture_id is not null;

create index if not exists order_items_fulfillment_status_idx
  on public.order_items(fulfillment_status);

create index if not exists payout_items_order_money_ledger_idx
  on public.payout_items(order_money_ledger_id)
  where order_money_ledger_id is not null;

create index if not exists order_money_ledger_payday_idx
  on public.order_money_ledger(status, payee_type, payee_id, payout_batch_id)
  where payee_type in ('seller', 'affiliate', 'influencer');

drop trigger if exists trg_order_money_ledger_updated_at on public.order_money_ledger;
create trigger trg_order_money_ledger_updated_at
  before update on public.order_money_ledger
  for each row execute function public.set_updated_at_timestamp();

alter table public.order_money_ledger enable row level security;
grant select on table public.order_money_ledger to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'order_money_ledger'
      and policyname = 'service role can access order money ledger'
  ) then
    create policy "service role can access order money ledger"
      on public.order_money_ledger
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

create or replace view public.order_money_ledger_payday_totals as
select
  payee_type,
  payee_id,
  currency,
  count(*) as ledger_row_count,
  round(sum(net_amount)::numeric, 2) as total_net_amount,
  min(hold_until) as oldest_released_hold,
  max(created_at) as newest_ledger_row
from public.order_money_ledger
where status = 'ready'
  and payout_batch_id is null
  and payee_type in ('seller', 'affiliate', 'influencer')
  and payee_id is not null
group by payee_type, payee_id, currency;

revoke all on public.order_money_ledger_payday_totals from anon, authenticated;
grant select on public.order_money_ledger_payday_totals to service_role;

create or replace function public.release_order_money_ledger_holds(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.order_money_ledger oml
  set status = 'ready',
      updated_at = now()
  from public.orders o
  where oml.order_id = o.id
    and oml.status = 'held'
    and oml.hold_until <= p_now
    and oml.payee_type in ('seller', 'affiliate', 'influencer')
    and coalesce(o.dispute_status::text, 'NONE') = 'NONE'
    and lower(coalesce(o.status::text, '')) not like '%refund%'
    and lower(coalesce(o.status::text, '')) not like '%cancel%'
    and lower(coalesce(o.payment_status::text, '')) not like '%refund%';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.release_order_money_ledger_holds(timestamptz) from public;
grant execute on function public.release_order_money_ledger_holds(timestamptz) to service_role;

create or replace function public.record_order_money_ledger_reversal(
  p_order_id uuid,
  p_reason text default 'refund',
  p_provider_capture_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  insert into public.order_money_ledger (
    source_key,
    order_id,
    order_item_id,
    payee_type,
    payee_id,
    currency,
    gross_amount,
    net_amount,
    status,
    hold_until,
    payout_batch_id,
    provider,
    provider_order_id,
    provider_capture_id,
    metadata,
    paid_at
  )
  select
    source_key || ':reversal:' || coalesce(nullif(trim(p_reason), ''), 'refund'),
    order_id,
    order_item_id,
    payee_type,
    payee_id,
    currency,
    round((-gross_amount)::numeric, 2),
    round((-net_amount)::numeric, 2),
    'reversed',
    null,
    payout_batch_id,
    provider,
    provider_order_id,
    coalesce(nullif(trim(p_provider_capture_id), ''), provider_capture_id),
    metadata || jsonb_build_object(
      'reversal_of', id,
      'reversal_reason', coalesce(nullif(trim(p_reason), ''), 'refund')
    ),
    case when status = 'paid' then now() else null end
  from public.order_money_ledger
  where order_id = p_order_id
    and net_amount <> 0
    and source_key not like '%:reversal:%'
  on conflict (source_key) do nothing;

  get diagnostics v_count = row_count;

  update public.order_money_ledger
  set status = case when status = 'paid' then status else 'cancelled' end,
      updated_at = now()
  where order_id = p_order_id
    and status in ('held', 'ready', 'failed', 'tracked')
    and source_key not like '%:reversal:%';

  return v_count;
end;
$$;

revoke all on function public.record_order_money_ledger_reversal(uuid, text, text) from public;
grant execute on function public.record_order_money_ledger_reversal(uuid, text, text) to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'order_money_ledger'
      and policyname = 'users can read own order money ledger rows'
  ) then
    create policy "users can read own order money ledger rows"
      on public.order_money_ledger
      for select
      to authenticated
      using (
        payee_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = order_money_ledger.payee_id
            and p.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.orders o
          where o.id = order_money_ledger.order_id
            and (
              o.buyer_id = auth.uid()
              or exists (
                select 1
                from public.profiles buyer_profile
                where buyer_profile.id = o.buyer_id
                  and buyer_profile.user_id = auth.uid()
              )
            )
        )
      );
  end if;
end $$;
