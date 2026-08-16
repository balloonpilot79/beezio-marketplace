-- Every active affiliate can recruit sellers/affiliates and earn lifetime influencer slots.
create or replace function public.ensure_affiliate_influencer_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'affiliate' and coalesce(new.is_active, true) then
    insert into public.user_roles (user_id, role, is_active)
    values (new.user_id, 'influencer', true)
    on conflict (user_id, role)
    do update set is_active = true, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_affiliate_grants_influencer on public.user_roles;
create trigger trg_affiliate_grants_influencer
after insert or update of role, is_active on public.user_roles
for each row execute function public.ensure_affiliate_influencer_role();

insert into public.user_roles (user_id, role, is_active)
select ur.user_id, 'influencer', true
from public.user_roles ur
where ur.role = 'affiliate' and coalesce(ur.is_active, true)
on conflict (user_id, role)
do update set is_active = true, updated_at = now();

-- Keep the legacy affiliate-dashboard downline table synchronized with the
-- canonical lifetime influencer_referrals table.
create or replace function public.sync_influencer_referral_to_legacy_referral()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_referrer_user_id uuid;
  v_referee_user_id uuid;
  v_referral_code text;
begin
  select p.user_id,
         coalesce(nullif(trim(p.referral_code), ''), 'BZO' || replace(p.id::text, '-', ''))
    into v_referrer_user_id, v_referral_code
  from public.profiles p
  where p.id = new.influencer_profile_id;

  select p.user_id
    into v_referee_user_id
  from public.profiles p
  where p.id = new.recruited_profile_id;

  if v_referrer_user_id is null or v_referee_user_id is null or v_referrer_user_id = v_referee_user_id then
    return new;
  end if;

  insert into public.referrals (
    referrer_id,
    referrer_profile_id,
    referee_id,
    referee_profile_id,
    referral_code,
    signup_date,
    status
  ) values (
    v_referrer_user_id,
    new.influencer_profile_id,
    v_referee_user_id,
    new.recruited_profile_id,
    v_referral_code,
    coalesce(new.created_at, now()),
    'active'
  )
  on conflict (referee_id) do update
  set referrer_id = excluded.referrer_id,
      referrer_profile_id = excluded.referrer_profile_id,
      referee_profile_id = excluded.referee_profile_id,
      referral_code = excluded.referral_code,
      status = 'active',
      updated_at = now()
  where public.referrals.referrer_profile_id is null
     or public.referrals.referrer_profile_id = excluded.referrer_profile_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_influencer_referral_to_legacy on public.influencer_referrals;
create trigger trg_sync_influencer_referral_to_legacy
after insert on public.influencer_referrals
for each row execute function public.sync_influencer_referral_to_legacy_referral();

insert into public.referrals (
  referrer_id,
  referrer_profile_id,
  referee_id,
  referee_profile_id,
  referral_code,
  signup_date,
  status
)
select distinct on (ir.recruited_profile_id)
  referrer.user_id,
  ir.influencer_profile_id,
  recruited.user_id,
  ir.recruited_profile_id,
  coalesce(nullif(trim(referrer.referral_code), ''), 'BZO' || replace(referrer.id::text, '-', '')),
  ir.created_at,
  'active'
from public.influencer_referrals ir
join public.profiles referrer on referrer.id = ir.influencer_profile_id
join public.profiles recruited on recruited.id = ir.recruited_profile_id
where referrer.user_id is not null
  and recruited.user_id is not null
  and referrer.user_id <> recruited.user_id
order by ir.recruited_profile_id, ir.created_at asc
on conflict (referee_id) do update
set referrer_id = excluded.referrer_id,
    referrer_profile_id = excluded.referrer_profile_id,
    referee_profile_id = excluded.referee_profile_id,
    referral_code = excluded.referral_code,
    status = 'active',
    updated_at = now()
where public.referrals.referrer_profile_id is null
   or public.referrals.referrer_profile_id = excluded.referrer_profile_id;

create unique index if not exists uq_referral_commissions_referral_order
on public.referral_commissions (referral_id, order_id)
where referral_id is not null and order_id is not null;

create or replace function public.sync_influencer_payout_to_referral_dashboard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral_id uuid;
  v_eligible_count integer := 0;
  v_share numeric(12,2) := 0;
  v_payment_status varchar := 'pending';
  v_paid_date timestamptz := null;
begin
  if new.payee_role::text <> 'INFLUENCER' then
    return new;
  end if;

  select count(distinct r.id)
    into v_eligible_count
  from public.orders o
  join public.influencer_referrals ir
    on ir.influencer_profile_id = new.payee_user_id
  join public.referrals r
    on r.referrer_profile_id = new.payee_user_id
   and r.referee_profile_id = ir.recruited_profile_id
  where o.id = new.order_id
    and (
      (ir.recruited_role = 'seller' and ir.recruited_profile_id = o.seller_id)
      or
      (ir.recruited_role = 'affiliate' and ir.recruited_profile_id = coalesce(o.partner_id, o.affiliate_id))
    );

  if v_eligible_count <= 0 then
    return new;
  end if;

  v_share := round((new.amount / v_eligible_count)::numeric, 2);
  v_payment_status := case
    when new.status::text = 'PAID' then 'paid'
    when new.status::text = 'CANCELED' then 'failed'
    else 'pending'
  end;
  v_paid_date := case when new.status::text = 'PAID' then coalesce(new.paid_at, now()) else null end;

  for v_referral_id in
    select distinct r.id
    from public.orders o
    join public.influencer_referrals ir
      on ir.influencer_profile_id = new.payee_user_id
    join public.referrals r
      on r.referrer_profile_id = new.payee_user_id
     and r.referee_profile_id = ir.recruited_profile_id
    where o.id = new.order_id
      and (
        (ir.recruited_role = 'seller' and ir.recruited_profile_id = o.seller_id)
        or
        (ir.recruited_role = 'affiliate' and ir.recruited_profile_id = coalesce(o.partner_id, o.affiliate_id))
      )
  loop
    insert into public.referral_commissions (
      referral_id,
      order_id,
      sale_amount,
      commission_rate,
      commission_amount,
      payment_status,
      paid_date,
      created_at
    ) values (
      v_referral_id,
      new.order_id,
      v_share,
      100,
      v_share,
      v_payment_status,
      v_paid_date,
      coalesce(new.created_at, now())
    )
    on conflict (referral_id, order_id)
      where referral_id is not null and order_id is not null
    do update set
      sale_amount = excluded.sale_amount,
      commission_rate = 100,
      commission_amount = excluded.commission_amount,
      payment_status = excluded.payment_status,
      paid_date = excluded.paid_date;

    update public.referrals r
    set total_commissions_earned = coalesce((
          select sum(rc.commission_amount)
          from public.referral_commissions rc
          where rc.referral_id = r.id
            and coalesce(rc.payment_status, 'pending') <> 'failed'
        ), 0),
        last_commission_date = (
          select max(rc.created_at)
          from public.referral_commissions rc
          where rc.referral_id = r.id
            and coalesce(rc.payment_status, 'pending') <> 'failed'
        ),
        updated_at = now()
    where r.id = v_referral_id;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_sync_influencer_payout_to_referral_dashboard on public.payout_snapshots;
create trigger trg_sync_influencer_payout_to_referral_dashboard
after insert or update of amount, status, paid_at on public.payout_snapshots
for each row execute function public.sync_influencer_payout_to_referral_dashboard();

revoke all on function public.ensure_affiliate_influencer_role() from public, anon, authenticated;
revoke all on function public.sync_influencer_referral_to_legacy_referral() from public, anon, authenticated;
revoke all on function public.sync_influencer_payout_to_referral_dashboard() from public, anon, authenticated;
grant execute on function public.ensure_affiliate_influencer_role() to service_role;
grant execute on function public.sync_influencer_referral_to_legacy_referral() to service_role;
grant execute on function public.sync_influencer_payout_to_referral_dashboard() to service_role;
