-- Buyers may refer shoppers, sellers, and affiliates without receiving any
-- business roles. Preserve first-referrer locks and the existing payout model.

CREATE OR REPLACE FUNCTION public.enforce_influencer_referrals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if new.recruited_profile_id = new.influencer_profile_id then
    raise exception 'A profile cannot be recruited by itself';
  end if;
  if tg_op = 'UPDATE'
     and old.influencer_profile_id is distinct from new.influencer_profile_id then
    raise exception 'Influencer referral is locked once assigned for this role';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = new.influencer_profile_id
      and (
        lower(coalesce(p.role,'')) = 'influencer'
        or lower(coalesce(p.primary_role,'')) = 'influencer'
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = p.user_id
            and ur.role in ('influencer', 'buyer')
            and ur.is_active = true
        )
      )
  ) then
    raise exception 'Assigned referrer must be an eligible ambassador';
  end if;
  new.updated_at := now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.attach_business_influencer_referral_from_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_referrer uuid;
  v_bundle_business_roles boolean;
  v_requested_role text;
begin
  v_requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', ''));
  v_bundle_business_roles := lower(coalesce(new.raw_user_meta_data ->> 'bundle_business_roles', 'false')) in ('true', '1', 'yes');

  if not v_bundle_business_roles and v_requested_role not in ('seller', 'affiliate', 'influencer') then
    return new;
  end if;

  begin
    v_referrer := nullif(new.raw_user_meta_data ->> 'referrer_profile_id', '')::uuid;
  exception when invalid_text_representation then
    v_referrer := null;
  end;

  if v_referrer is null or v_referrer = new.id then
    return new;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_referrer
      and (
        lower(coalesce(p.role, '')) = 'influencer'
        or lower(coalesce(p.primary_role, '')) = 'influencer'
        or exists (
          select 1
          from public.user_roles ur
          where ur.user_id = p.user_id
            and ur.role in ('influencer', 'buyer')
            and ur.is_active = true
        )
      )
  ) then
    return new;
  end if;

  update public.profiles
  set recruited_by_influencer_id = v_referrer
  where id = new.id
    and recruited_by_influencer_id is null;

  if v_bundle_business_roles then
    insert into public.user_roles (user_id, role, is_active)
    values
      (new.id, 'seller', true),
      (new.id, 'affiliate', true),
      (new.id, 'influencer', true)
    on conflict (user_id, role) do update set is_active = true;

    insert into public.influencer_referrals (recruited_profile_id, recruited_role, influencer_profile_id)
    values
      (new.id, 'seller', v_referrer),
      (new.id, 'affiliate', v_referrer)
    on conflict (recruited_profile_id, recruited_role) do nothing;
  elsif v_requested_role in ('seller', 'affiliate') then
    insert into public.influencer_referrals (recruited_profile_id, recruited_role, influencer_profile_id)
    values (new.id, v_requested_role, v_referrer)
    on conflict (recruited_profile_id, recruited_role) do nothing;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION beezio_private.attach_buyer_referral_from_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  referrer_id uuid;
begin
  if coalesce(new.raw_user_meta_data ->> 'role', '') <> 'buyer'
     or lower(coalesce(new.raw_user_meta_data ->> 'bundle_business_roles', 'false')) in ('true', '1', 'yes') then
    return new;
  end if;

  begin
    referrer_id := nullif(new.raw_user_meta_data ->> 'buyer_referrer_profile_id', '')::uuid;
  exception when invalid_text_representation then
    return new;
  end;

  if referrer_id is null or referrer_id = new.id then
    return new;
  end if;

  insert into public.influencer_referrals (recruited_profile_id, recruited_role, influencer_profile_id)
  select new.id, 'buyer', p.id
  from public.profiles p
  where p.id = referrer_id and (
    p.role = 'influencer' or p.primary_role = 'influencer' or exists (
      select 1 from public.user_roles r
      where r.user_id = p.user_id and r.role in ('influencer', 'buyer') and r.is_active
    )
  )
  on conflict (recruited_profile_id, recruited_role) do nothing;
  return new;
end;
$function$
;


