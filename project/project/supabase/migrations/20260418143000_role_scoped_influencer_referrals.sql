create table if not exists public.influencer_referrals (
  id uuid primary key default gen_random_uuid(),
  recruited_profile_id uuid not null references public.profiles(id) on delete cascade,
  recruited_role text not null check (recruited_role in ('seller', 'affiliate')),
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
as $$
begin
  if new.recruited_profile_id = new.influencer_profile_id then
    raise exception 'A profile cannot be recruited by itself';
  end if;

  if tg_op = 'UPDATE'
     and old.influencer_profile_id is not null
     and old.influencer_profile_id is distinct from new.influencer_profile_id then
    raise exception 'Influencer referral is locked once assigned for this role';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.influencer_profile_id
      and (
        lower(coalesce(p.role, '')) = 'influencer'
        or lower(coalesce(p.primary_role, '')) = 'influencer'
      )
  ) then
    raise exception 'Assigned recruiter must be an influencer profile';
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
  on public.influencer_referrals
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Users can read own influencer referrals" on public.influencer_referrals;
create policy "Users can read own influencer referrals"
  on public.influencer_referrals
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id in (influencer_referrals.recruited_profile_id, influencer_referrals.influencer_profile_id)
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create own influencer referrals" on public.influencer_referrals;
create policy "Users can create own influencer referrals"
  on public.influencer_referrals
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = influencer_referrals.recruited_profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own influencer referrals" on public.influencer_referrals;
create policy "Users can update own influencer referrals"
  on public.influencer_referrals
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = influencer_referrals.recruited_profile_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = influencer_referrals.recruited_profile_id
        and p.user_id = auth.uid()
    )
  );

insert into public.influencer_referrals (recruited_profile_id, recruited_role, influencer_profile_id)
select distinct p.id, ur.role, p.recruited_by_influencer_id
from public.profiles p
join public.user_roles ur
  on ur.user_id = p.user_id
 and ur.is_active = true
 and ur.role in ('seller', 'affiliate')
where p.recruited_by_influencer_id is not null
on conflict (recruited_profile_id, recruited_role) do nothing;

comment on table public.influencer_referrals is 'Role-scoped influencer recruiter assignments for seller and affiliate earnings attribution.';
