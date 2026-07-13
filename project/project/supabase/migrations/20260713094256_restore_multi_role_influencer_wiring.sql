-- Restore safe multi-role accounts and role-scoped influencer attribution.

alter table public.profiles drop constraint if exists profiles_primary_role_check;
alter table public.profiles
  add constraint profiles_primary_role_check
  check (primary_role is null or primary_role in ('buyer','seller','affiliate','influencer','fundraiser','admin'));

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role is null or role in ('buyer','seller','affiliate','influencer','fundraiser','admin'));

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('buyer','seller','affiliate','influencer','fundraiser','admin'));

drop policy if exists "Users can insert own roles" on public.user_roles;
create policy "Users can insert own roles"
  on public.user_roles for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and role in ('buyer','seller','affiliate','influencer','fundraiser')
  );

drop policy if exists "Users can update own roles" on public.user_roles;
create policy "Users can update own roles"
  on public.user_roles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and role in ('buyer','seller','affiliate','influencer','fundraiser')
  );

drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and coalesce(role, 'buyer') <> 'admin'
    and coalesce(primary_role, 'buyer') <> 'admin'
  );

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and coalesce(role, 'buyer') <> 'admin'
    and coalesce(primary_role, 'buyer') <> 'admin'
  );

create or replace function public.enforce_primary_role_is_granted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.primary_role is null or new.primary_role = old.primary_role then
    return new;
  end if;
  if new.primary_role = 'admin' then
    raise exception 'Admin role cannot be self-assigned';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = new.user_id
      and ur.role = new.primary_role
      and ur.is_active = true
  ) then
    raise exception 'Primary role must be an active granted role';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_primary_role_is_granted on public.profiles;
create trigger enforce_primary_role_is_granted
before update of primary_role on public.profiles
for each row execute function public.enforce_primary_role_is_granted();

create table if not exists public.influencer_referrals (
  id uuid primary key default gen_random_uuid(),
  recruited_profile_id uuid not null references public.profiles(id) on delete cascade,
  recruited_role text not null check (recruited_role in ('seller','affiliate')),
  influencer_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recruited_profile_id, recruited_role)
);

create index if not exists idx_influencer_referrals_influencer_role
  on public.influencer_referrals(influencer_profile_id, recruited_role);
create index if not exists idx_influencer_referrals_recruited_profile
  on public.influencer_referrals(recruited_profile_id);

create or replace function public.enforce_influencer_referrals()
returns trigger
language plpgsql
set search_path = public
as $$
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
            and ur.role = 'influencer'
            and ur.is_active = true
        )
      )
  ) then
    raise exception 'Assigned recruiter must have an active influencer role';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_influencer_referrals_enforce on public.influencer_referrals;
create trigger trg_influencer_referrals_enforce
before insert or update on public.influencer_referrals
for each row execute function public.enforce_influencer_referrals();

alter table public.influencer_referrals enable row level security;

drop policy if exists "Service role can manage influencer referrals" on public.influencer_referrals;
create policy "Service role can manage influencer referrals"
  on public.influencer_referrals for all to service_role
  using (true) with check (true);

drop policy if exists "Users can read own influencer referrals" on public.influencer_referrals;
create policy "Users can read own influencer referrals"
  on public.influencer_referrals for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id in (influencer_referrals.recruited_profile_id, influencer_referrals.influencer_profile_id)
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can create own influencer referrals" on public.influencer_referrals;
create policy "Users can create own influencer referrals"
  on public.influencer_referrals for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = influencer_referrals.recruited_profile_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update own influencer referrals" on public.influencer_referrals;
create policy "Users can update own influencer referrals"
  on public.influencer_referrals for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = influencer_referrals.recruited_profile_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = influencer_referrals.recruited_profile_id
        and p.user_id = (select auth.uid())
    )
  );

grant select, insert, update on public.influencer_referrals to authenticated;
grant all on public.influencer_referrals to service_role;

-- These legacy SECURITY DEFINER helpers bypass RLS. The app uses direct,
-- owner-scoped table access, so only trusted backend code should execute them.
revoke all on function public.add_user_role(uuid,text) from public, anon, authenticated;
revoke all on function public.switch_primary_role(uuid,text) from public, anon, authenticated;
revoke all on function public.get_user_roles(uuid) from public, anon, authenticated;
revoke all on function public.user_has_role(uuid,text) from public, anon, authenticated;
revoke all on function public.ensure_default_custom_stores_for_new_profile() from public, anon, authenticated;
revoke all on function public.ensure_default_custom_stores_for_profile(uuid) from public, anon, authenticated;
revoke all on function public.unique_store_slug_for_bootstrap(text,text,uuid) from public, anon, authenticated;

grant execute on function public.add_user_role(uuid,text) to service_role;
grant execute on function public.switch_primary_role(uuid,text) to service_role;
grant execute on function public.get_user_roles(uuid) to service_role;
grant execute on function public.user_has_role(uuid,text) to service_role;
grant execute on function public.ensure_default_custom_stores_for_profile(uuid) to service_role;
