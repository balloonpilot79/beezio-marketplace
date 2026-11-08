-- Complete the bundle for existing business accounts with active role grants.
-- Preserve accounts with an explicitly disabled business role for review.
insert into public.user_roles (user_id, role, is_active)
select accounts.user_id, capability.role, true
from (
  select distinct user_id
  from public.user_roles as active_grant
  where active_grant.is_active = true
    and active_grant.role in ('seller', 'affiliate', 'influencer')
    and not exists (
      select 1 from public.user_roles as disabled_grant
      where disabled_grant.user_id = active_grant.user_id
        and disabled_grant.role in ('seller', 'affiliate', 'influencer')
        and disabled_grant.is_active = false
    )
) as accounts
cross join (values ('seller'), ('affiliate'), ('influencer')) as capability(role)
on conflict (user_id, role) do nothing;

create schema if not exists beezio_private;
revoke all on schema beezio_private from public;

create function beezio_private.grant_registered_business_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := lower(coalesce(new.raw_user_meta_data ->> 'role', 'buyer'));
begin
  -- The registration selection is read once at account creation.
  if requested_role in ('seller', 'affiliate', 'influencer') then
    insert into public.user_roles (user_id, role, is_active)
    values (new.id, 'seller', true), (new.id, 'affiliate', true), (new.id, 'influencer', true)
    on conflict (user_id, role) do nothing;
  end if;

  -- The existing profile trigger uses buyer as its fallback for legacy
  -- influencer registration before verification sets the primary role.
  if requested_role not in ('seller', 'affiliate') then
    insert into public.user_roles (user_id, role, is_active)
    values (new.id, case when requested_role = 'fundraiser' then 'fundraiser' else 'buyer' end, true)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function beezio_private.grant_registered_business_roles() from public, anon, authenticated;

-- Runs before on_auth_user_created_create_profile, which sets the primary role.
create trigger on_auth_user_created_business_roles
after insert on auth.users
for each row execute function beezio_private.grant_registered_business_roles();

-- Limit self-service writes regardless of which legacy permissive policy matched.
create policy "Business roles require registration or admin provisioning"
on public.user_roles as restrictive for insert to authenticated
with check ((select auth.uid()) <> user_id or role not in ('seller', 'affiliate', 'influencer'));

create policy "Business roles cannot be self-modified"
on public.user_roles as restrictive for update to authenticated
using ((select auth.uid()) <> user_id or role not in ('seller', 'affiliate', 'influencer'))
with check ((select auth.uid()) <> user_id or role not in ('seller', 'affiliate', 'influencer'));

create policy "Profile business roles require active grants on insert"
on public.profiles as restrictive for insert to authenticated
with check (
  (select auth.uid()) <> user_id or not exists (
    select 1 from (values (profiles.role), (profiles.primary_role)) as requested(role)
    where requested.role in ('seller', 'affiliate', 'influencer')
      and not exists (
        select 1 from public.user_roles as granted
        where granted.user_id = profiles.user_id and granted.role = requested.role and granted.is_active = true
      )
  )
);

create policy "Profile business roles require active grants on update"
on public.profiles as restrictive for update to authenticated
with check (
  (select auth.uid()) <> user_id or not exists (
    select 1 from (values (profiles.role), (profiles.primary_role)) as requested(role)
    where requested.role in ('seller', 'affiliate', 'influencer')
      and not exists (
        select 1 from public.user_roles as granted
        where granted.user_id = profiles.user_id and granted.role = requested.role and granted.is_active = true
      )
  )
);
