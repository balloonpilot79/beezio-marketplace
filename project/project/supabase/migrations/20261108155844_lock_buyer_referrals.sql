alter table public.influencer_referrals
  drop constraint influencer_referrals_recruited_role_check,
  add constraint influencer_referrals_recruited_role_check
    check (recruited_role in ('seller', 'affiliate', 'buyer'));

-- Only the signup trigger may establish a buyer referral. Existing business
-- referral policies still apply to seller and affiliate rows.
create policy "Buyer referral signup is server controlled"
  on public.influencer_referrals as restrictive for insert to authenticated
  with check (recruited_role <> 'buyer');
create policy "Buyer referral is immutable for shoppers"
  on public.influencer_referrals as restrictive for update to authenticated
  using (recruited_role <> 'buyer') with check (recruited_role <> 'buyer');
create policy "Buyer referral cannot be deleted by shoppers"
  on public.influencer_referrals as restrictive for delete to authenticated
  using (recruited_role <> 'buyer');

create function beezio_private.attach_buyer_referral_from_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
      where r.user_id = p.user_id and r.role = 'influencer' and r.is_active
    )
  )
  on conflict (recruited_profile_id, recruited_role) do nothing;
  return new;
end;
$$;

revoke all on function beezio_private.attach_buyer_referral_from_signup() from public, anon, authenticated;
create trigger on_auth_user_created_lock_shopper_referral
after insert on auth.users
for each row execute function beezio_private.attach_buyer_referral_from_signup();
