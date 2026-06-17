create extension if not exists pgcrypto;

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.insurance_admin_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.insurance_admin_settings (setting_key, setting_value)
values
  ('min_lead_price_cents', '500'::jsonb),
  ('min_beezio_fee_cents', '100'::jsonb),
  ('min_affiliate_payout_cents', '200'::jsonb)
on conflict (setting_key) do nothing;

drop trigger if exists set_insurance_admin_settings_updated_at on public.insurance_admin_settings;
create trigger set_insurance_admin_settings_updated_at
before update on public.insurance_admin_settings
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.insurance_agent_wallets (
  id uuid primary key default gen_random_uuid(),
  agent_user_id uuid not null references public.profiles(id) on delete cascade,
  balance_cents bigint not null default 0,
  currency text not null default 'USD',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_agent_wallets_balance_nonnegative check (balance_cents >= 0)
);

create unique index if not exists insurance_agent_wallets_agent_user_idx
  on public.insurance_agent_wallets(agent_user_id);

drop trigger if exists set_insurance_agent_wallets_updated_at on public.insurance_agent_wallets;
create trigger set_insurance_agent_wallets_updated_at
before update on public.insurance_agent_wallets
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.insurance_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.insurance_agent_wallets(id) on delete cascade,
  type text not null,
  amount_cents bigint not null,
  reference_type text,
  reference_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists insurance_wallet_transactions_wallet_created_idx
  on public.insurance_wallet_transactions(wallet_id, created_at desc);

create table if not exists public.insurance_affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  trust_tier text not null default 'new',
  daily_valid_lead_cap integer not null default 5,
  fraud_flag_count integer not null default 0,
  payout_hold_days integer not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insurance_affiliate_profiles_affiliate_idx
  on public.insurance_affiliate_profiles(affiliate_user_id);

drop trigger if exists set_insurance_affiliate_profiles_updated_at on public.insurance_affiliate_profiles;
create trigger set_insurance_affiliate_profiles_updated_at
before update on public.insurance_affiliate_profiles
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.insurance_lead_package_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vertical text not null,
  qualified_lead_count integer not null,
  package_price_cents integer not null,
  implied_cost_per_lead_cents integer not null,
  suggested_affiliate_payout_cents integer not null,
  suggested_beezio_fee_cents integer not null,
  min_allowed_agent_price_cents integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_insurance_lead_package_templates_updated_at on public.insurance_lead_package_templates;
create trigger set_insurance_lead_package_templates_updated_at
before update on public.insurance_lead_package_templates
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.insurance_agent_lead_packages (
  id uuid primary key default gen_random_uuid(),
  agent_user_id uuid not null references public.profiles(id) on delete cascade,
  package_template_id uuid references public.insurance_lead_package_templates(id) on delete set null,
  vertical text not null,
  purchased_lead_count integer not null,
  delivered_lead_count integer not null default 0,
  remaining_lead_count integer not null,
  package_price_cents integer not null,
  effective_cost_per_lead_cents integer not null,
  affiliate_payout_cents integer not null,
  beezio_fee_cents integer not null,
  status text not null default 'active',
  funded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_agent_lead_packages_remaining_nonnegative check (remaining_lead_count >= 0)
);

create index if not exists insurance_agent_lead_packages_agent_idx
  on public.insurance_agent_lead_packages(agent_user_id, status, created_at desc);

drop trigger if exists set_insurance_agent_lead_packages_updated_at on public.insurance_agent_lead_packages;
create trigger set_insurance_agent_lead_packages_updated_at
before update on public.insurance_agent_lead_packages
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.insurance_lead_campaigns (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.insurance_agent_listings(id) on delete set null,
  agent_user_id uuid not null references public.profiles(id) on delete cascade,
  vertical text not null default 'life',
  lead_type text not null default 'quote_request',
  max_cost_per_lead_cents integer not null,
  cost_per_lead_cents integer not null,
  affiliate_payout_cents integer not null,
  beezio_fee_cents integer not null,
  daily_cap integer,
  status text not null default 'paused',
  targeting_json jsonb not null default '{}'::jsonb,
  pricing_mode text not null default 'standard',
  package_id uuid references public.insurance_agent_lead_packages(id) on delete set null,
  min_affiliate_payout_cents integer not null default 200,
  min_beezio_fee_cents integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_lead_campaigns_agent_status_idx
  on public.insurance_lead_campaigns(agent_user_id, status, vertical);

create index if not exists insurance_lead_campaigns_listing_idx
  on public.insurance_lead_campaigns(listing_id);

drop trigger if exists set_insurance_lead_campaigns_updated_at on public.insurance_lead_campaigns;
create trigger set_insurance_lead_campaigns_updated_at
before update on public.insurance_lead_campaigns
for each row
execute function public.set_timestamp_updated_at();

alter table public.insurance_agent_listings
  add column if not exists verticals text[] not null default '{life}'::text[],
  add column if not exists lead_price_cents integer not null default 1000,
  add column if not exists is_admin_only boolean not null default true,
  add column if not exists public_contact_blocked boolean not null default true,
  add column if not exists website_enabled boolean not null default true;

update public.insurance_agent_listings
set lead_price_cents = coalesce(lead_price_cents, (coalesce(lead_price, 10.00) * 100)::integer)
where lead_price_cents is null or lead_price_cents = 0;

create table if not exists public.insurance_affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid references public.profiles(id) on delete set null,
  tracking_code text,
  listing_id uuid references public.insurance_agent_listings(id) on delete set null,
  campaign_id uuid references public.insurance_lead_campaigns(id) on delete set null,
  click_ip_hash text,
  click_user_agent text,
  click_fingerprint text,
  created_at timestamptz not null default now()
);

create index if not exists insurance_affiliate_clicks_affiliate_created_idx
  on public.insurance_affiliate_clicks(affiliate_user_id, created_at desc);

create table if not exists public.insurance_blocked_ips (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null unique,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.insurance_leads
  add column if not exists campaign_id uuid references public.insurance_lead_campaigns(id) on delete set null,
  add column if not exists vertical text not null default 'life',
  add column if not exists affiliate_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists agent_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists lead_price_cents integer not null default 0,
  add column if not exists affiliate_payout_cents integer not null default 0,
  add column if not exists influencer_payout_cents integer not null default 0,
  add column if not exists paypal_fee_cents integer not null default 0,
  add column if not exists beezio_fee_cents integer not null default 0,
  add column if not exists payload_json jsonb not null default '{}'::jsonb,
  add column if not exists duplicate_hash text,
  add column if not exists submitted_ip_hash text,
  add column if not exists form_started_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists completion_seconds integer,
  add column if not exists honeypot_value text,
  add column if not exists anti_bot_passed boolean not null default false,
  add column if not exists fraud_score integer not null default 0,
  add column if not exists fraud_flags_json jsonb not null default '[]'::jsonb,
  add column if not exists review_status text not null default 'auto_approved',
  add column if not exists is_duplicate boolean not null default false,
  add column if not exists duplicate_lead_id uuid references public.insurance_leads(id) on delete set null,
  add column if not exists status_reason text,
  add column if not exists delivered_at timestamptz,
  add column if not exists final_validated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.insurance_leads
set agent_user_id = coalesce(agent_user_id, agent_profile_id),
    affiliate_user_id = coalesce(affiliate_user_id, affiliate_id),
    submitted_ip_hash = coalesce(submitted_ip_hash, ip_hash),
    payload_json = coalesce(payload_json, metadata, '{}'::jsonb),
    lead_price_cents = case when coalesce(lead_price_cents, 0) > 0 then lead_price_cents else (coalesce(lead_price, 0) * 100)::integer end,
    affiliate_payout_cents = case when coalesce(affiliate_payout_cents, 0) > 0 then affiliate_payout_cents else (coalesce(affiliate_payout, 0) * 100)::integer end,
    influencer_payout_cents = case when coalesce(influencer_payout_cents, 0) > 0 then influencer_payout_cents else (coalesce(influencer_payout, 0) * 100)::integer end,
    paypal_fee_cents = case when coalesce(paypal_fee_cents, 0) > 0 then paypal_fee_cents else (coalesce(paypal_fee_estimate, 0) * 100)::integer end,
    beezio_fee_cents = case when coalesce(beezio_fee_cents, 0) > 0 then beezio_fee_cents else (coalesce(beezio_fee_gross, 0) * 100)::integer end
where true;

create index if not exists insurance_leads_campaign_created_idx
  on public.insurance_leads(campaign_id, created_at desc);

create index if not exists insurance_leads_duplicate_hash_idx
  on public.insurance_leads(duplicate_hash, created_at desc);

create index if not exists insurance_leads_submitted_ip_hash_idx
  on public.insurance_leads(submitted_ip_hash, created_at desc);

drop trigger if exists set_insurance_leads_updated_at on public.insurance_leads;
create trigger set_insurance_leads_updated_at
before update on public.insurance_leads
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.insurance_affiliate_earnings (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  lead_id uuid not null unique references public.insurance_leads(id) on delete cascade,
  amount_cents integer not null,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_affiliate_earnings_affiliate_status_idx
  on public.insurance_affiliate_earnings(affiliate_user_id, status, created_at desc);

drop trigger if exists set_insurance_affiliate_earnings_updated_at on public.insurance_affiliate_earnings;
create trigger set_insurance_affiliate_earnings_updated_at
before update on public.insurance_affiliate_earnings
for each row
execute function public.set_timestamp_updated_at();

create table if not exists public.insurance_lead_disputes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.insurance_leads(id) on delete cascade,
  agent_user_id uuid not null references public.profiles(id) on delete cascade,
  reason_code text not null,
  reason_text text,
  status text not null default 'open',
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_insurance_lead_disputes_updated_at on public.insurance_lead_disputes;
create trigger set_insurance_lead_disputes_updated_at
before update on public.insurance_lead_disputes
for each row
execute function public.set_timestamp_updated_at();

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
  v_affiliate_hold_days integer := 7;
  v_affiliate_earning_status text := 'pending_review';
  v_earning_id uuid;
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

  if v_lead.status = 'delivered' then
    return jsonb_build_object('ok', true, 'reason', 'already_delivered', 'lead_id', v_lead.id);
  end if;

  select * into v_campaign
  from public.insurance_lead_campaigns
  where id = v_lead.campaign_id
  for update;

  if not found then
    raise exception 'Campaign not found';
  end if;

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

  if v_lead.affiliate_user_id is not null and coalesce(v_campaign.affiliate_payout_cents, 0) > 0 then
    select coalesce(payout_hold_days, 7) into v_affiliate_hold_days
    from public.insurance_affiliate_profiles
    where affiliate_user_id = v_lead.affiliate_user_id;

    if coalesce(v_affiliate_hold_days, 0) <= 0 then
      v_affiliate_earning_status := 'credited';
    end if;

    insert into public.insurance_affiliate_earnings (
      affiliate_user_id,
      lead_id,
      amount_cents,
      status
    )
    values (
      v_lead.affiliate_user_id,
      v_lead.id,
      v_campaign.affiliate_payout_cents,
      v_affiliate_earning_status
    )
    returning id into v_earning_id;
  end if;

  update public.insurance_leads
  set status = 'delivered',
      review_status = case when review_status = 'submitted' then 'manually_approved' else review_status end,
      status_reason = null,
      delivered_at = now(),
      final_validated_at = now(),
      updated_at = now()
  where id = v_lead.id;

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

  return jsonb_build_object(
    'ok', true,
    'lead_id', v_lead.id,
    'wallet_balance_cents', v_wallet_after,
    'affiliate_earning_id', v_earning_id
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
    set balance_cents = balance_cents + coalesce(v_lead.lead_price, 0)::bigint,
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
  else
    update public.insurance_leads
    set status = 'dispute_denied',
        updated_at = now()
    where id = v_lead.id;
  end if;

  update public.insurance_lead_disputes
  set status = p_resolution,
      resolution_notes = p_notes,
      updated_at = now()
  where id = v_dispute.id;

  return jsonb_build_object('ok', true, 'status', p_resolution);
end;
$$;

alter table public.insurance_admin_settings enable row level security;
alter table public.insurance_agent_wallets enable row level security;
alter table public.insurance_wallet_transactions enable row level security;
alter table public.insurance_affiliate_profiles enable row level security;
alter table public.insurance_lead_package_templates enable row level security;
alter table public.insurance_agent_lead_packages enable row level security;
alter table public.insurance_lead_campaigns enable row level security;
alter table public.insurance_affiliate_clicks enable row level security;
alter table public.insurance_blocked_ips enable row level security;
alter table public.insurance_affiliate_earnings enable row level security;
alter table public.insurance_lead_disputes enable row level security;

drop policy if exists "insurance wallets owner read" on public.insurance_agent_wallets;
create policy "insurance wallets owner read"
on public.insurance_agent_wallets
for select
using (
  agent_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.id = insurance_agent_wallets.agent_user_id
  )
);

drop policy if exists "insurance wallet txns owner read" on public.insurance_wallet_transactions;
create policy "insurance wallet txns owner read"
on public.insurance_wallet_transactions
for select
using (
  exists (
    select 1
    from public.insurance_agent_wallets w
    join public.profiles p on p.id = w.agent_user_id
    where w.id = insurance_wallet_transactions.wallet_id
      and (w.agent_user_id = auth.uid() or p.user_id = auth.uid())
  )
);

drop policy if exists "insurance campaigns owner read" on public.insurance_lead_campaigns;
create policy "insurance campaigns owner read"
on public.insurance_lead_campaigns
for select
using (
  agent_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.id = insurance_lead_campaigns.agent_user_id
  )
);

drop policy if exists "insurance earnings owner read" on public.insurance_affiliate_earnings;
create policy "insurance earnings owner read"
on public.insurance_affiliate_earnings
for select
using (
  affiliate_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.id = insurance_affiliate_earnings.affiliate_user_id
  )
);

drop policy if exists "insurance disputes owner read" on public.insurance_lead_disputes;
create policy "insurance disputes owner read"
on public.insurance_lead_disputes
for select
using (
  agent_user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.id = insurance_lead_disputes.agent_user_id
  )
);
