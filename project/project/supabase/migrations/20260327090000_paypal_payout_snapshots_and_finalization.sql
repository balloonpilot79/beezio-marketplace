-- PayPal payout finalization hardening:
-- - immutable per-payee payout snapshots
-- - provider id uniqueness for idempotency
-- - transactional RPC to finalize a captured order exactly once

alter table public.orders
  add column if not exists payment_finalized_at timestamptz;

create unique index if not exists orders_provider_order_id_unique
  on public.orders(provider_order_id)
  where provider_order_id is not null;

create unique index if not exists orders_provider_capture_id_unique
  on public.orders(provider_capture_id)
  where provider_capture_id is not null;

create table if not exists public.payout_snapshots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ledger_id uuid references public.payout_ledger(id) on delete set null,
  payee_user_id uuid not null references public.profiles(id) on delete cascade,
  payee_role paypal_account_role not null,
  provider text not null default 'paypal',
  provider_order_id text,
  provider_capture_id text,
  currency text not null default 'USD',
  amount numeric(10,2) not null default 0,
  status payout_ledger_status not null default 'PENDING_HOLD',
  hold_release_at timestamptz,
  paid_at timestamptz,
  snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists payout_snapshots_order_payee_unique
  on public.payout_snapshots(order_id, payee_user_id, payee_role);

create index if not exists payout_snapshots_payee_status_idx
  on public.payout_snapshots(payee_user_id, payee_role, status, hold_release_at);

create index if not exists payout_snapshots_ledger_idx
  on public.payout_snapshots(ledger_id);

create index if not exists payout_snapshots_provider_capture_idx
  on public.payout_snapshots(provider_capture_id)
  where provider_capture_id is not null;

alter table public.payout_snapshots enable row level security;
grant select on table public.payout_snapshots to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payout_snapshots'
      and policyname = 'service role can access payout snapshots'
  ) then
    create policy "service role can access payout snapshots"
      on public.payout_snapshots
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payout_snapshots'
      and policyname = 'users can read own payout snapshots'
  ) then
    create policy "users can read own payout snapshots"
      on public.payout_snapshots
      for select
      to authenticated
      using (
        payee_user_id = auth.uid()
        or exists (
          select 1
          from public.profiles p
          where p.id = payout_snapshots.payee_user_id
            and p.user_id = auth.uid()
        )
      );
  end if;
end $$;

drop trigger if exists trg_payout_snapshots_updated_at on public.payout_snapshots;
create trigger trg_payout_snapshots_updated_at
  before update on public.payout_snapshots
  for each row execute function public.set_updated_at_timestamp();

create or replace function public.record_paypal_order_finalization(
  p_order_id uuid,
  p_provider_order_id text,
  p_provider_capture_id text,
  p_paid_at timestamptz,
  p_currency text,
  p_hold_release_at timestamptz,
  p_order_totals jsonb,
  p_ledger_totals jsonb,
  p_snapshots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_ledger_id uuid;
  v_result jsonb;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  update public.orders
  set payment_provider = 'PAYPAL',
      provider_order_id = coalesce(nullif(trim(p_provider_order_id), ''), provider_order_id),
      provider_capture_id = coalesce(nullif(trim(p_provider_capture_id), ''), provider_capture_id),
      status = case when status = 'refunded' then status else 'completed' end,
      payment_status = case when payment_status = 'refunded' then payment_status else 'paid' end,
      paid_at = coalesce(p_paid_at, paid_at, now()),
      subtotal_listing = coalesce((p_order_totals->>'subtotal_listing')::numeric, subtotal_listing),
      shipping_amount = coalesce((p_order_totals->>'shipping_amount')::numeric, shipping_amount),
      tax_amount = coalesce((p_order_totals->>'tax_amount')::numeric, tax_amount),
      total_charged = coalesce((p_order_totals->>'total_charged')::numeric, total_charged),
      total_amount = coalesce((p_order_totals->>'total_charged')::numeric, total_amount),
      payment_finalized_at = coalesce(payment_finalized_at, p_paid_at, now()),
      updated_at = now()
  where id = p_order_id;

  insert into public.payout_ledger (
    order_id,
    seller_id,
    partner_id,
    influencer_id,
    gross_amount,
    seller_earnings,
    partner_earnings,
    influencer_earnings,
    beezio_fee,
    paypal_fee_estimate,
    status,
    hold_release_at,
    notes,
    beezio_fee_gross,
    beezio_fee_net,
    platform_fee_gross,
    platform_fee_net,
    beezio_profit
  )
  values (
    p_order_id,
    nullif(p_ledger_totals->>'seller_id', '')::uuid,
    nullif(p_ledger_totals->>'partner_id', '')::uuid,
    nullif(p_ledger_totals->>'influencer_id', '')::uuid,
    coalesce((p_ledger_totals->>'gross_amount')::numeric, 0),
    coalesce((p_ledger_totals->>'seller_earnings')::numeric, 0),
    coalesce((p_ledger_totals->>'partner_earnings')::numeric, 0),
    coalesce((p_ledger_totals->>'influencer_earnings')::numeric, 0),
    coalesce((p_ledger_totals->>'beezio_fee_net')::numeric, 0),
    coalesce((p_ledger_totals->>'paypal_fee_estimate')::numeric, 0),
    coalesce((p_ledger_totals->>'status')::payout_ledger_status, 'PENDING_HOLD'::payout_ledger_status),
    coalesce(p_hold_release_at, now()),
    nullif(p_ledger_totals->>'notes', ''),
    coalesce((p_ledger_totals->>'beezio_fee_gross')::numeric, 0),
    coalesce((p_ledger_totals->>'beezio_fee_net')::numeric, 0),
    coalesce((p_ledger_totals->>'beezio_fee_gross')::numeric, 0),
    coalesce((p_ledger_totals->>'beezio_fee_net')::numeric, 0),
    coalesce((p_ledger_totals->>'beezio_profit')::numeric, 0)
  )
  on conflict (order_id) do update
    set seller_id = excluded.seller_id,
        partner_id = excluded.partner_id,
        influencer_id = excluded.influencer_id,
        gross_amount = excluded.gross_amount,
        seller_earnings = excluded.seller_earnings,
        partner_earnings = excluded.partner_earnings,
        influencer_earnings = excluded.influencer_earnings,
        beezio_fee = excluded.beezio_fee,
        paypal_fee_estimate = excluded.paypal_fee_estimate,
        status = case
          when public.payout_ledger.status = 'PAID' then public.payout_ledger.status
          when public.payout_ledger.status = 'ON_HOLD_DISPUTE' then public.payout_ledger.status
          when public.payout_ledger.status = 'CANCELED' then public.payout_ledger.status
          else excluded.status
        end,
        hold_release_at = excluded.hold_release_at,
        notes = excluded.notes,
        beezio_fee_gross = excluded.beezio_fee_gross,
        beezio_fee_net = excluded.beezio_fee_net,
        platform_fee_gross = excluded.platform_fee_gross,
        platform_fee_net = excluded.platform_fee_net,
        beezio_profit = excluded.beezio_profit,
        updated_at = now()
  returning id into v_ledger_id;

  insert into public.payout_snapshots (
    order_id,
    ledger_id,
    payee_user_id,
    payee_role,
    provider,
    provider_order_id,
    provider_capture_id,
    currency,
    amount,
    status,
    hold_release_at,
    snapshot_json
  )
  select
    p_order_id,
    v_ledger_id,
    nullif(s.payee_user_id, '')::uuid,
    s.payee_role::paypal_account_role,
    'paypal',
    nullif(s.provider_order_id, ''),
    nullif(s.provider_capture_id, ''),
    coalesce(nullif(s.currency, ''), upper(coalesce(p_currency, 'USD'))),
    coalesce(s.amount, 0),
    coalesce(s.status::payout_ledger_status, 'PENDING_HOLD'::payout_ledger_status),
    s.hold_release_at,
    coalesce(s.snapshot_json, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_snapshots, '[]'::jsonb)) as s(
    payee_user_id text,
    payee_role text,
    provider_order_id text,
    provider_capture_id text,
    currency text,
    amount numeric,
    status text,
    hold_release_at timestamptz,
    snapshot_json jsonb
  )
  on conflict (order_id, payee_user_id, payee_role) do update
    set ledger_id = excluded.ledger_id,
        provider_order_id = coalesce(excluded.provider_order_id, public.payout_snapshots.provider_order_id),
        provider_capture_id = coalesce(excluded.provider_capture_id, public.payout_snapshots.provider_capture_id),
        currency = excluded.currency,
        amount = excluded.amount,
        status = case
          when public.payout_snapshots.status = 'PAID' then public.payout_snapshots.status
          when public.payout_snapshots.status = 'ON_HOLD_DISPUTE' then public.payout_snapshots.status
          when public.payout_snapshots.status = 'CANCELED' then public.payout_snapshots.status
          else excluded.status
        end,
        hold_release_at = excluded.hold_release_at,
        snapshot_json = excluded.snapshot_json,
        updated_at = now();

  v_result := jsonb_build_object(
    'order_id', p_order_id,
    'ledger_id', v_ledger_id,
    'provider_order_id', p_provider_order_id,
    'provider_capture_id', p_provider_capture_id,
    'snapshot_count', jsonb_array_length(coalesce(p_snapshots, '[]'::jsonb))
  );

  return v_result;
end;
$$;

revoke all on function public.record_paypal_order_finalization(uuid, text, text, timestamptz, text, timestamptz, jsonb, jsonb, jsonb) from public;
grant execute on function public.record_paypal_order_finalization(uuid, text, text, timestamptz, text, timestamptz, jsonb, jsonb, jsonb) to service_role;
