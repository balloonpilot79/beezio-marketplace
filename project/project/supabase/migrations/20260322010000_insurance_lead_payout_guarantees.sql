alter table public.payout_ledger
  add column if not exists insurance_lead_id uuid references public.insurance_leads(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payout_ledger_insurance_lead_id_key'
      and conrelid = 'public.payout_ledger'::regclass
  ) then
    alter table public.payout_ledger
      add constraint payout_ledger_insurance_lead_id_key unique (insurance_lead_id);
  end if;
end $$;

create index if not exists idx_payout_ledger_insurance_lead
  on public.payout_ledger(insurance_lead_id);

alter table public.insurance_affiliate_earnings
  add column if not exists hold_release_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists payout_ledger_id uuid references public.payout_ledger(id) on delete set null;

create index if not exists insurance_affiliate_earnings_payout_ledger_idx
  on public.insurance_affiliate_earnings(payout_ledger_id);

create table if not exists public.insurance_influencer_earnings (
  id uuid primary key default gen_random_uuid(),
  influencer_user_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid not null unique references public.insurance_leads(id) on delete cascade,
  amount_cents integer not null,
  status text not null default 'pending_review',
  hold_release_at timestamptz,
  paid_at timestamptz,
  payout_ledger_id uuid references public.payout_ledger(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_influencer_earnings_influencer_status_idx
  on public.insurance_influencer_earnings(influencer_user_id, status, created_at desc);

create index if not exists insurance_influencer_earnings_payout_ledger_idx
  on public.insurance_influencer_earnings(payout_ledger_id);

drop trigger if exists set_insurance_influencer_earnings_updated_at on public.insurance_influencer_earnings;
create trigger set_insurance_influencer_earnings_updated_at
before update on public.insurance_influencer_earnings
for each row
execute function public.set_timestamp_updated_at();

alter table public.insurance_influencer_earnings enable row level security;
grant select on table public.insurance_influencer_earnings to authenticated;

drop policy if exists "insurance influencer earnings owner read" on public.insurance_influencer_earnings;
create policy "insurance influencer earnings owner read"
on public.insurance_influencer_earnings
for select
using (
  influencer_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.id = insurance_influencer_earnings.influencer_user_id
  )
);

with lead_payouts as (
  select
    l.id as lead_id,
    case
      when coalesce(ap.payout_hold_days, 7) <= 0 then coalesce(l.delivered_at, l.final_validated_at, l.created_at, now())
      else coalesce(l.delivered_at, l.final_validated_at, l.created_at, now()) + make_interval(days => coalesce(ap.payout_hold_days, 7))
    end as hold_release_at,
    case
      when l.status = 'dispute_approved' then 'CANCELED'::public.payout_ledger_status
      when l.status = 'disputed'
        or exists (
          select 1
          from public.insurance_lead_disputes d
          where d.lead_id = l.id
            and d.status = 'open'
        ) then 'ON_HOLD_DISPUTE'::public.payout_ledger_status
      when coalesce(ap.payout_hold_days, 7) <= 0
        or coalesce(l.delivered_at, l.final_validated_at, l.created_at, now()) + make_interval(days => coalesce(ap.payout_hold_days, 7)) <= now() then 'READY_TO_PAY'::public.payout_ledger_status
      else 'PENDING_HOLD'::public.payout_ledger_status
    end as payout_status
  from public.insurance_leads l
  left join public.insurance_affiliate_profiles ap
    on ap.affiliate_user_id = l.affiliate_user_id
  where l.status in ('delivered', 'dispute_denied', 'disputed', 'dispute_approved')
)
insert into public.payout_ledger (
  insurance_lead_id,
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
  beezio_fee_gross,
  beezio_fee_net,
  beezio_profit,
  notes
)
select
  l.id,
  null,
  case when coalesce(l.affiliate_payout_cents, 0) > 0 then l.affiliate_user_id else null end,
  case when coalesce(l.influencer_payout_cents, 0) > 0 then l.influencer_id else null end,
  round(coalesce(l.lead_price_cents, 0)::numeric / 100.0, 2),
  0,
  round(coalesce(l.affiliate_payout_cents, 0)::numeric / 100.0, 2),
  round(coalesce(l.influencer_payout_cents, 0)::numeric / 100.0, 2),
  round(coalesce(l.beezio_fee_cents, 0)::numeric / 100.0, 2),
  round(coalesce(l.paypal_fee_cents, 0)::numeric / 100.0, 2),
  lp.payout_status,
  lp.hold_release_at,
  round(coalesce(l.beezio_fee_cents, 0)::numeric / 100.0, 2),
  round(greatest(coalesce(l.beezio_fee_cents, 0) - coalesce(l.paypal_fee_cents, 0), 0)::numeric / 100.0, 2),
  round(greatest(coalesce(l.beezio_fee_cents, 0) - coalesce(l.paypal_fee_cents, 0), 0)::numeric / 100.0, 2),
  'Insurance lead payout'
from public.insurance_leads l
join lead_payouts lp
  on lp.lead_id = l.id
where not exists (
  select 1
  from public.payout_ledger existing
  where existing.insurance_lead_id = l.id
);

update public.insurance_affiliate_earnings ae
set hold_release_at = coalesce(ae.hold_release_at, pl.hold_release_at),
    paid_at = case when pl.status = 'PAID' then coalesce(ae.paid_at, pl.paid_at, now()) else ae.paid_at end,
    payout_ledger_id = coalesce(ae.payout_ledger_id, pl.id),
    status = case
      when pl.status = 'PAID' then 'paid'
      when pl.status = 'READY_TO_PAY' then 'ready_to_pay'
      when pl.status = 'ON_HOLD_DISPUTE' then 'on_hold_dispute'
      when pl.status = 'CANCELED' then 'canceled'
      else 'pending_review'
    end,
    updated_at = now()
from public.payout_ledger pl
where pl.insurance_lead_id = ae.lead_id;

insert into public.insurance_influencer_earnings (
  influencer_user_id,
  lead_id,
  amount_cents,
  status,
  hold_release_at,
  paid_at,
  payout_ledger_id
)
select
  l.influencer_id,
  l.id,
  coalesce(l.influencer_payout_cents, 0),
  case
    when pl.status = 'PAID' then 'paid'
    when pl.status = 'READY_TO_PAY' then 'ready_to_pay'
    when pl.status = 'ON_HOLD_DISPUTE' then 'on_hold_dispute'
    when pl.status = 'CANCELED' then 'canceled'
    else 'pending_review'
  end,
  pl.hold_release_at,
  case when pl.status = 'PAID' then coalesce(pl.paid_at, now()) else null end,
  pl.id
from public.insurance_leads l
join public.payout_ledger pl
  on pl.insurance_lead_id = l.id
where l.influencer_id is not null
  and coalesce(l.influencer_payout_cents, 0) > 0
  and not exists (
    select 1
    from public.insurance_influencer_earnings existing
    where existing.lead_id = l.id
  );

create or replace function public.process_insurance_approved_lead(p_lead_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_lead public.insurance_leads%rowtype;
  v_campaign public.insurance_lead_campaigns%rowtype;
  v_wallet public.insurance_agent_wallets%rowtype;
  v_package public.insurance_agent_lead_packages%rowtype;
  v_wallet_after bigint;
  v_today_count integer;
  v_hold_days integer := 7;
  v_hold_release_at timestamptz;
  v_payout_status public.payout_ledger_status := 'PENDING_HOLD';
  v_affiliate_status text := 'pending_review';
  v_influencer_status text := 'pending_review';
  v_affiliate_earning_id uuid;
  v_influencer_earning_id uuid;
  v_payout_ledger_id uuid;
  v_existing_wallet_txn_id uuid;
begin
  select * into v_lead
  from public.insurance_leads
  where id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead not found';
  end if;

  if v_lead.review_status = 'flagged' or v_lead.review_status = 'rejected' or v_lead.status = 'invalid' then
    return jsonb_build_object('ok', false, 'reason', 'lead_not_approved');
  end if;

  select * into v_campaign
  from public.insurance_lead_campaigns
  where id = v_lead.campaign_id
  for update;

  if not found then
    raise exception 'Campaign not found';
  end if;

  if v_lead.status <> 'delivered' then
    if v_campaign.status not in ('active', 'paused', 'out_of_funds') then
      return jsonb_build_object('ok', false, 'reason', 'campaign_not_active');
    end if;

    if v_campaign.daily_cap is not null then
      select count(*)::integer into v_today_count
      from public.insurance_leads
      where campaign_id = v_campaign.id
        and status = 'delivered'
        and created_at >= date_trunc('day', now());

      if v_today_count >= v_campaign.daily_cap then
        update public.insurance_lead_campaigns
        set status = 'paused'
        where id = v_campaign.id;
        return jsonb_build_object('ok', false, 'reason', 'daily_cap_reached');
      end if;
    end if;

    select * into v_wallet
    from public.insurance_agent_wallets
    where agent_user_id = v_campaign.agent_user_id
    for update;

    if not found then
      raise exception 'Wallet not found';
    end if;

    select id into v_existing_wallet_txn_id
    from public.insurance_wallet_transactions
    where wallet_id = v_wallet.id
      and reference_type = 'lead'
      and reference_id = v_lead.id
      and type = 'lead_charge'
    limit 1;

    if v_existing_wallet_txn_id is null then
      if coalesce(v_wallet.balance_cents, 0) < coalesce(v_campaign.cost_per_lead_cents, 0) then
        update public.insurance_leads
        set status = 'undeliverable_due_to_insufficient_funds',
            status_reason = 'wallet_insufficient_funds',
            updated_at = now()
        where id = v_lead.id;

        update public.insurance_lead_campaigns
        set status = 'out_of_funds'
        where id = v_campaign.id;

        return jsonb_build_object('ok', false, 'reason', 'insufficient_funds');
      end if;

      if v_campaign.pricing_mode = 'package' and v_campaign.package_id is not null then
        select * into v_package
        from public.insurance_agent_lead_packages
        where id = v_campaign.package_id
        for update;

        if not found or coalesce(v_package.remaining_lead_count, 0) <= 0 then
          update public.insurance_lead_campaigns
          set status = 'out_of_funds'
          where id = v_campaign.id;
          return jsonb_build_object('ok', false, 'reason', 'package_exhausted');
        end if;

        update public.insurance_agent_lead_packages
        set remaining_lead_count = greatest(remaining_lead_count - 1, 0),
            delivered_lead_count = delivered_lead_count + 1,
            status = case when remaining_lead_count - 1 <= 0 then 'completed' else status end,
            updated_at = now()
        where id = v_package.id;
      end if;

      v_wallet_after := v_wallet.balance_cents - v_campaign.cost_per_lead_cents;

      update public.insurance_agent_wallets
      set balance_cents = v_wallet_after,
          status = case when v_wallet_after <= 0 then 'low_balance' else status end,
          updated_at = now()
      where id = v_wallet.id;

      insert into public.insurance_wallet_transactions (
        wallet_id,
        type,
        amount_cents,
        reference_type,
        reference_id,
        notes
      )
      values (
        v_wallet.id,
        'lead_charge',
        v_campaign.cost_per_lead_cents,
        'lead',
        v_lead.id,
        'Qualified insurance lead delivered'
      );
    else
      v_wallet_after := coalesce(v_wallet.balance_cents, 0);
    end if;

    update public.insurance_leads
    set status = 'delivered',
        review_status = case when review_status = 'submitted' then 'manually_approved' else review_status end,
        status_reason = null,
        delivered_at = coalesce(delivered_at, now()),
        final_validated_at = now(),
        updated_at = now()
    where id = v_lead.id
    returning * into v_lead;

    if v_wallet_after < v_campaign.cost_per_lead_cents then
      update public.insurance_lead_campaigns
      set status = 'out_of_funds',
          updated_at = now()
      where id = v_campaign.id;
    elsif v_campaign.status <> 'active' then
      update public.insurance_lead_campaigns
      set status = 'active',
          updated_at = now()
      where id = v_campaign.id;
    end if;
  else
    select * into v_wallet
    from public.insurance_agent_wallets
    where agent_user_id = v_campaign.agent_user_id
    limit 1;
    v_wallet_after := coalesce(v_wallet.balance_cents, 0);
  end if;

  if v_lead.affiliate_user_id is not null then
    select coalesce(payout_hold_days, 7) into v_hold_days
    from public.insurance_affiliate_profiles
    where affiliate_user_id = v_lead.affiliate_user_id;
  end if;

  v_hold_days := coalesce(v_hold_days, 7);
  v_hold_release_at := coalesce(v_lead.delivered_at, now()) + make_interval(days => greatest(v_hold_days, 0));

  if v_hold_days <= 0 or v_hold_release_at <= now() then
    v_payout_status := 'READY_TO_PAY';
    v_affiliate_status := 'ready_to_pay';
    v_influencer_status := 'ready_to_pay';
  end if;

  insert into public.payout_ledger (
    insurance_lead_id,
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
    beezio_fee_gross,
    beezio_fee_net,
    beezio_profit,
    notes
  )
  values (
    v_lead.id,
    null,
    case when coalesce(v_lead.affiliate_payout_cents, 0) > 0 then v_lead.affiliate_user_id else null end,
    case when coalesce(v_lead.influencer_payout_cents, 0) > 0 then v_lead.influencer_id else null end,
    round(coalesce(v_lead.lead_price_cents, 0)::numeric / 100.0, 2),
    0,
    round(coalesce(v_lead.affiliate_payout_cents, 0)::numeric / 100.0, 2),
    round(coalesce(v_lead.influencer_payout_cents, 0)::numeric / 100.0, 2),
    round(coalesce(v_lead.beezio_fee_cents, 0)::numeric / 100.0, 2),
    round(coalesce(v_lead.paypal_fee_cents, 0)::numeric / 100.0, 2),
    v_payout_status,
    v_hold_release_at,
    round(coalesce(v_lead.beezio_fee_cents, 0)::numeric / 100.0, 2),
    round(greatest(coalesce(v_lead.beezio_fee_cents, 0) - coalesce(v_lead.paypal_fee_cents, 0), 0)::numeric / 100.0, 2),
    round(greatest(coalesce(v_lead.beezio_fee_cents, 0) - coalesce(v_lead.paypal_fee_cents, 0), 0)::numeric / 100.0, 2),
    'Insurance lead payout'
  )
  on conflict (insurance_lead_id) do update
  set partner_id = excluded.partner_id,
      influencer_id = excluded.influencer_id,
      gross_amount = excluded.gross_amount,
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
      beezio_fee_gross = excluded.beezio_fee_gross,
      beezio_fee_net = excluded.beezio_fee_net,
      beezio_profit = excluded.beezio_profit,
      notes = excluded.notes,
      updated_at = now()
  returning id into v_payout_ledger_id;

  if v_lead.affiliate_user_id is not null and coalesce(v_lead.affiliate_payout_cents, 0) > 0 then
    insert into public.insurance_affiliate_earnings (
      affiliate_user_id,
      lead_id,
      amount_cents,
      status,
      hold_release_at,
      payout_ledger_id
    )
    values (
      v_lead.affiliate_user_id,
      v_lead.id,
      v_lead.affiliate_payout_cents,
      v_affiliate_status,
      v_hold_release_at,
      v_payout_ledger_id
    )
    on conflict (lead_id) do update
    set amount_cents = excluded.amount_cents,
        status = case
          when public.insurance_affiliate_earnings.status = 'paid' then public.insurance_affiliate_earnings.status
          when public.insurance_affiliate_earnings.status = 'canceled' then public.insurance_affiliate_earnings.status
          when public.insurance_affiliate_earnings.status = 'on_hold_dispute' then public.insurance_affiliate_earnings.status
          else excluded.status
        end,
        hold_release_at = excluded.hold_release_at,
        payout_ledger_id = excluded.payout_ledger_id,
        updated_at = now()
    returning id into v_affiliate_earning_id;
  end if;

  if v_lead.influencer_id is not null and coalesce(v_lead.influencer_payout_cents, 0) > 0 then
    insert into public.insurance_influencer_earnings (
      influencer_user_id,
      lead_id,
      amount_cents,
      status,
      hold_release_at,
      payout_ledger_id
    )
    values (
      v_lead.influencer_id,
      v_lead.id,
      v_lead.influencer_payout_cents,
      v_influencer_status,
      v_hold_release_at,
      v_payout_ledger_id
    )
    on conflict (lead_id) do update
    set amount_cents = excluded.amount_cents,
        status = case
          when public.insurance_influencer_earnings.status = 'paid' then public.insurance_influencer_earnings.status
          when public.insurance_influencer_earnings.status = 'canceled' then public.insurance_influencer_earnings.status
          when public.insurance_influencer_earnings.status = 'on_hold_dispute' then public.insurance_influencer_earnings.status
          else excluded.status
        end,
        hold_release_at = excluded.hold_release_at,
        payout_ledger_id = excluded.payout_ledger_id,
        updated_at = now()
    returning id into v_influencer_earning_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead.id,
    'wallet_balance_cents', v_wallet_after,
    'affiliate_earning_id', v_affiliate_earning_id,
    'influencer_earning_id', v_influencer_earning_id,
    'payout_ledger_id', v_payout_ledger_id
  );
end;
$$;

create or replace function public.resolve_insurance_dispute(
  p_dispute_id uuid,
  p_resolution text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_dispute public.insurance_lead_disputes%rowtype;
  v_lead public.insurance_leads%rowtype;
  v_wallet public.insurance_agent_wallets%rowtype;
begin
  select * into v_dispute
  from public.insurance_lead_disputes
  where id = p_dispute_id
  for update;

  if not found then
    raise exception 'Dispute not found';
  end if;

  if v_dispute.status <> 'open' then
    return jsonb_build_object('ok', false, 'reason', 'already_resolved');
  end if;

  select * into v_lead
  from public.insurance_leads
  where id = v_dispute.lead_id
  for update;

  if p_resolution = 'approved' then
    select * into v_wallet
    from public.insurance_agent_wallets
    where agent_user_id = v_dispute.agent_user_id
    for update;

    if not found then
      raise exception 'Wallet not found';
    end if;

    update public.insurance_agent_wallets
    set balance_cents = balance_cents + coalesce(v_lead.lead_price_cents, 0)::bigint,
        status = 'active',
        updated_at = now()
    where id = v_wallet.id;

    insert into public.insurance_wallet_transactions (
      wallet_id,
      type,
      amount_cents,
      reference_type,
      reference_id,
      notes
    )
    values (
      v_wallet.id,
      'dispute_credit',
      coalesce(v_lead.lead_price_cents, 0)::bigint,
      'lead_dispute',
      v_lead.id,
      coalesce(p_notes, 'Approved dispute credit')
    );

    update public.insurance_leads
    set status = 'dispute_approved',
        updated_at = now()
    where id = v_lead.id;

    update public.payout_ledger
    set status = case when status = 'PAID' then status else 'CANCELED' end,
        notes = coalesce(p_notes, 'Insurance lead dispute approved'),
        updated_at = now()
    where insurance_lead_id = v_lead.id;

    update public.insurance_affiliate_earnings
    set status = case when status = 'paid' then status else 'canceled' end,
        updated_at = now()
    where lead_id = v_lead.id;

    update public.insurance_influencer_earnings
    set status = case when status = 'paid' then status else 'canceled' end,
        updated_at = now()
    where lead_id = v_lead.id;
  else
    update public.insurance_leads
    set status = 'dispute_denied',
        updated_at = now()
    where id = v_lead.id;

    update public.payout_ledger
    set status = case
          when paid_at is not null or status = 'PAID' then 'PAID'
          when hold_release_at <= now() then 'READY_TO_PAY'
          else 'PENDING_HOLD'
        end,
        updated_at = now()
    where insurance_lead_id = v_lead.id;

    update public.insurance_affiliate_earnings
    set status = case
          when paid_at is not null or status = 'paid' then 'paid'
          when coalesce(hold_release_at, now()) <= now() then 'ready_to_pay'
          else 'pending_review'
        end,
        updated_at = now()
    where lead_id = v_lead.id;

    update public.insurance_influencer_earnings
    set status = case
          when paid_at is not null or status = 'paid' then 'paid'
          when coalesce(hold_release_at, now()) <= now() then 'ready_to_pay'
          else 'pending_review'
        end,
        updated_at = now()
    where lead_id = v_lead.id;
  end if;

  update public.insurance_lead_disputes
  set status = p_resolution,
      resolution_notes = p_notes,
      updated_at = now()
  where id = v_dispute.id;

  return jsonb_build_object('ok', true, 'status', p_resolution);
end;
$$;
