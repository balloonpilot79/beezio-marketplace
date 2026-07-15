-- Make business-account recruiter attribution durable at auth signup time.
-- The relationship is immutable once set and is resolved again for every
-- future seller/affiliate sale by the PayPal finalization code.

create or replace function public.lock_profile_influencer_recruiter()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.recruited_by_influencer_id is not null
     and old.recruited_by_influencer_id is distinct from new.recruited_by_influencer_id then
    raise exception 'Influencer recruiter attribution is permanent once assigned';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_profile_influencer_recruiter on public.profiles;
create trigger trg_lock_profile_influencer_recruiter
before update of recruited_by_influencer_id on public.profiles
for each row execute function public.lock_profile_influencer_recruiter();

create or replace function public.attach_business_influencer_referral_from_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
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
            and ur.role = 'influencer'
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
$$;

drop trigger if exists on_auth_user_created_lock_influencer_referral on auth.users;
create trigger on_auth_user_created_lock_influencer_referral
after insert on auth.users
for each row execute function public.attach_business_influencer_referral_from_signup();

insert into public.influencer_referrals (recruited_profile_id, recruited_role, influencer_profile_id)
select p.id, roles.recruited_role, p.recruited_by_influencer_id
from public.profiles p
cross join lateral (
  values ('seller'::text), ('affiliate'::text)
) as roles(recruited_role)
where p.recruited_by_influencer_id is not null
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = p.user_id
      and ur.role = roles.recruited_role
      and ur.is_active = true
  )
on conflict (recruited_profile_id, recruited_role) do nothing;

revoke all on function public.lock_profile_influencer_recruiter() from public, anon, authenticated;
revoke all on function public.attach_business_influencer_referral_from_signup() from public, anon, authenticated;
grant execute on function public.lock_profile_influencer_recruiter() to service_role;
grant execute on function public.attach_business_influencer_referral_from_signup() to service_role;
