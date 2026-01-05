-- Unify payout-related RLS policies across roles
-- - Sellers + affiliates are paid bi-monthly; sellers may have held funds until shipped + 14 days.
-- - Fundraisers are paid on the affiliate rail.
-- - Buyers never have payout access.
-- - Admin can view/manage payout tables.
-- Safe to run multiple times.

create or replace function public.is_profile_owner(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = profile_id
      and (
        p.user_id = auth.uid()
        or p.id = auth.uid()
      )
  );
$$;

create or replace function public.has_active_role(role_name text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and lower(ur.role) = lower(role_name)
      and ur.is_active = true
  );
$$;

-- Ensure authenticated users can call helper functions used in RLS expressions.
grant execute on function public.is_profile_owner(uuid) to authenticated;
grant execute on function public.has_active_role(text) to authenticated;

-- Helper: admin check (email allowlist). Kept defensive if function is missing.
create or replace function public.is_beezio_admin_safe()
returns boolean
language plpgsql
stable
as $$
begin
  if to_regprocedure('public.is_beezio_admin_email_allowlisted()') is not null then
    return public.is_beezio_admin_email_allowlisted();
  end if;
  return false;
end;
$$;

grant execute on function public.is_beezio_admin_safe() to authenticated;

-- =================
-- payout_requests
-- =================
do $do$
begin
  if to_regclass('public.payout_requests') is null then
    return;
  end if;

  execute 'alter table public.payout_requests enable row level security';

  execute 'drop policy if exists "Users can view their own payout requests" on public.payout_requests';
  execute 'drop policy if exists "Users can create their own payout requests" on public.payout_requests';
  execute 'drop policy if exists "Admins can view all payout requests" on public.payout_requests';
  execute 'drop policy if exists "payout_requests_select_own_or_admin" on public.payout_requests';
  execute 'drop policy if exists "payout_requests_insert_eligible" on public.payout_requests';
  execute 'drop policy if exists "payout_requests_admin_manage" on public.payout_requests';

  execute $pol$
    create policy "payout_requests_select_own_or_admin"
      on public.payout_requests
      for select
      to authenticated
      using (
        public.is_profile_owner(
          coalesce(
            (to_jsonb(payout_requests)->>'user_id')::uuid,
            (to_jsonb(payout_requests)->>'profile_id')::uuid,
            (to_jsonb(payout_requests)->>'owner_id')::uuid
          )
        )
        or public.is_beezio_admin_safe()
      )
  $pol$;

  -- Only sellers/affiliates (or fundraisers via affiliate rail) may create requests for themselves.
  execute $pol$
    create policy "payout_requests_insert_eligible"
      on public.payout_requests
      for insert
      to authenticated
      with check (
        public.is_profile_owner(
          coalesce(
            (to_jsonb(payout_requests)->>'user_id')::uuid,
            (to_jsonb(payout_requests)->>'profile_id')::uuid,
            (to_jsonb(payout_requests)->>'owner_id')::uuid
          )
        )
        and lower(role) in ('seller','affiliate')
        and (
          public.has_active_role(role)
          or (lower(role) = 'affiliate' and public.has_active_role('fundraiser'))
        )
        and lower(coalesce(status, 'pending')) = 'pending'
        and processed_at is null
      )
  $pol$;

  execute $pol$
    create policy "payout_requests_admin_manage"
      on public.payout_requests
      for all
      to authenticated
      using (public.is_beezio_admin_safe())
      with check (public.is_beezio_admin_safe())
  $pol$;
end;
$do$;

-- =================
-- user_earnings
-- =================
do $do$
begin
  if to_regclass('public.user_earnings') is null then
    return;
  end if;

  execute 'alter table public.user_earnings enable row level security';

  execute 'drop policy if exists "user_earnings_select_own_or_admin" on public.user_earnings';
  execute 'drop policy if exists "user_earnings_admin_manage" on public.user_earnings';

  execute $pol$
    create policy "user_earnings_select_own_or_admin"
      on public.user_earnings
      for select
      to authenticated
      using (
        public.is_profile_owner(
          coalesce(
            (to_jsonb(user_earnings)->>'user_id')::uuid,
            (to_jsonb(user_earnings)->>'profile_id')::uuid,
            (to_jsonb(user_earnings)->>'owner_id')::uuid
          )
        )
        or public.is_beezio_admin_safe()
      )
  $pol$;

  execute $pol$
    create policy "user_earnings_admin_manage"
      on public.user_earnings
      for all
      to authenticated
      using (public.is_beezio_admin_safe())
      with check (public.is_beezio_admin_safe())
  $pol$;
end;
$do$;

-- ======================
-- payment_distributions
-- ======================
do $do$
begin
  if to_regclass('public.payment_distributions') is null then
    return;
  end if;

  execute 'alter table public.payment_distributions enable row level security';

  execute 'drop policy if exists "payment_distributions_select_own_or_admin" on public.payment_distributions';
  execute 'drop policy if exists "payment_distributions_admin_manage" on public.payment_distributions';

  execute $pol$
    create policy "payment_distributions_select_own_or_admin"
      on public.payment_distributions
      for select
      to authenticated
      using (
        (
          recipient_type in ('seller','affiliate')
          and recipient_id is not null
          and public.is_profile_owner(recipient_id)
        )
        or public.is_beezio_admin_safe()
      )
  $pol$;

  execute $pol$
    create policy "payment_distributions_admin_manage"
      on public.payment_distributions
      for all
      to authenticated
      using (public.is_beezio_admin_safe())
      with check (public.is_beezio_admin_safe())
  $pol$;
end;
$do$;

-- ======
-- payouts
-- ======
do $do$
declare
  owner_expr text;
begin
  if to_regclass('public.payouts') is null then
    return;
  end if;

  execute 'alter table public.payouts enable row level security';

  execute 'drop policy if exists "payouts_select_own_or_admin" on public.payouts';
  execute 'drop policy if exists "payouts_admin_manage" on public.payouts';

  -- Schemas vary across deployments. Use a JSON-based coalesce so missing columns don't break policy creation.
  owner_expr := $$public.is_profile_owner(
    coalesce(
      (to_jsonb(payouts)->>'user_id')::uuid,
      (to_jsonb(payouts)->>'beneficiary_id')::uuid,
      (to_jsonb(payouts)->>'destination_user_id')::uuid,
      (to_jsonb(payouts)->>'recipient_id')::uuid
    )
  )$$;

  execute format($pol$
    create policy "payouts_select_own_or_admin"
      on public.payouts
      for select
      to authenticated
      using (
        %s
        or public.is_beezio_admin_safe()
      )
  $pol$, owner_expr);

  execute $pol$
    create policy "payouts_admin_manage"
      on public.payouts
      for all
      to authenticated
      using (public.is_beezio_admin_safe())
      with check (public.is_beezio_admin_safe())
  $pol$;
end;
$do$;

-- ============
-- payout_batches
-- ============
do $do$
begin
  if to_regclass('public.payout_batches') is null then
    return;
  end if;

  execute 'alter table public.payout_batches enable row level security';

  execute 'drop policy if exists "payout_batches_admin_only" on public.payout_batches';

  execute $pol$
    create policy "payout_batches_admin_only"
      on public.payout_batches
      for all
      to authenticated
      using (public.is_beezio_admin_safe())
      with check (public.is_beezio_admin_safe())
  $pol$;
end;
$do$;

-- ==============
-- platform_revenue
-- ==============
do $do$
begin
  if to_regclass('public.platform_revenue') is null then
    return;
  end if;

  execute 'alter table public.platform_revenue enable row level security';

  execute 'drop policy if exists "platform_revenue_admin_only" on public.platform_revenue';

  execute $pol$
    create policy "platform_revenue_admin_only"
      on public.platform_revenue
      for all
      to authenticated
      using (public.is_beezio_admin_safe())
      with check (public.is_beezio_admin_safe())
  $pol$;
end;
$do$;
