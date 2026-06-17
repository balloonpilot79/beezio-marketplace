delete from public.insurance_wallet_transactions t
using public.insurance_wallet_transactions newer
where t.id <> newer.id
  and t.wallet_id = newer.wallet_id
  and coalesce(t.reference_type, '') = coalesce(newer.reference_type, '')
  and t.reference_id is not null
  and t.reference_id = newer.reference_id
  and t.created_at < newer.created_at;

create unique index if not exists insurance_wallet_transactions_reference_unique
  on public.insurance_wallet_transactions(wallet_id, reference_type, reference_id)
  where reference_id is not null;

delete from public.vendor_orders v
using public.vendor_orders newer
where v.id <> newer.id
  and v.order_id = newer.order_id
  and v.vendor_id = newer.vendor_id
  and v.created_at < newer.created_at;

create unique index if not exists vendor_orders_order_vendor_unique
  on public.vendor_orders(order_id, vendor_id);

create or replace function public.fund_insurance_wallet(
  p_agent_user_id uuid,
  p_amount_cents bigint,
  p_reference_type text default 'manual_funding',
  p_reference_id uuid default null,
  p_notes text default null
)
returns public.insurance_agent_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.insurance_agent_wallets%rowtype;
begin
  if p_agent_user_id is null then
    raise exception 'agent_user_id is required';
  end if;

  if coalesce(p_amount_cents, 0) <= 0 then
    raise exception 'amount_cents must be greater than zero';
  end if;

  insert into public.insurance_agent_wallets (
    agent_user_id,
    balance_cents,
    currency,
    status
  )
  values (
    p_agent_user_id,
    0,
    'USD',
    'active'
  )
  on conflict (agent_user_id) do nothing;

  select *
  into v_wallet
  from public.insurance_agent_wallets
  where agent_user_id = p_agent_user_id
  for update;

  if p_reference_id is not null and exists (
    select 1
    from public.insurance_wallet_transactions txn
    where txn.wallet_id = v_wallet.id
      and coalesce(txn.reference_type, '') = coalesce(p_reference_type, '')
      and txn.reference_id = p_reference_id
  ) then
    return v_wallet;
  end if;

  update public.insurance_agent_wallets
  set balance_cents = balance_cents + p_amount_cents,
      status = 'active',
      updated_at = now()
  where id = v_wallet.id
  returning *
  into v_wallet;

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
    'funding',
    p_amount_cents,
    p_reference_type,
    p_reference_id,
    p_notes
  );

  return v_wallet;
end;
$$;

create or replace function public.purchase_insurance_lead_package(
  p_agent_user_id uuid,
  p_package_template_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template public.insurance_lead_package_templates%rowtype;
  v_package public.insurance_agent_lead_packages%rowtype;
  v_wallet public.insurance_agent_wallets%rowtype;
  v_note text;
begin
  if p_agent_user_id is null then
    raise exception 'agent_user_id is required';
  end if;

  if p_package_template_id is null then
    raise exception 'package_template_id is required';
  end if;

  select *
  into v_template
  from public.insurance_lead_package_templates
  where id = p_package_template_id
    and is_active = true;

  if not found then
    raise exception 'package template not found';
  end if;

  insert into public.insurance_agent_lead_packages (
    agent_user_id,
    package_template_id,
    vertical,
    purchased_lead_count,
    delivered_lead_count,
    remaining_lead_count,
    package_price_cents,
    effective_cost_per_lead_cents,
    affiliate_payout_cents,
    beezio_fee_cents,
    status,
    funded_at
  )
  values (
    p_agent_user_id,
    p_package_template_id,
    v_template.vertical,
    greatest(coalesce(v_template.qualified_lead_count, 0), 1),
    0,
    greatest(coalesce(v_template.qualified_lead_count, 0), 1),
    greatest(coalesce(v_template.package_price_cents, 0), 0),
    greatest(coalesce(v_template.implied_cost_per_lead_cents, 0), 0),
    greatest(coalesce(v_template.suggested_affiliate_payout_cents, 0), 0),
    greatest(coalesce(v_template.suggested_beezio_fee_cents, 0), 0),
    'active',
    now()
  )
  returning *
  into v_package;

  v_note := coalesce(
    nullif(trim(p_notes), ''),
    'Package funded: ' || coalesce(nullif(trim(v_template.name), ''), v_template.vertical)
  );

  v_wallet := public.fund_insurance_wallet(
    p_agent_user_id,
    greatest(coalesce(v_template.package_price_cents, 0), 0),
    'package_funding',
    v_package.id,
    v_note
  );

  return jsonb_build_object(
    'package', to_jsonb(v_package),
    'wallet', to_jsonb(v_wallet)
  );
end;
$$;
