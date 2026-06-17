-- Enable RLS on public.transactions (Supabase Security Advisor)
-- - Lets participants in an order read their transactions
-- - Keeps write access admin/service-role only
-- - Service role retains full access
-- Safe to run multiple times.

-- Helper: profile ownership (defensive; some installs use profiles.id = auth.uid, others use profiles.user_id)
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

grant execute on function public.is_profile_owner(uuid) to authenticated;

-- Helper: admin check (email allowlist). Kept defensive if allowlist function is missing.
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

-- Apply RLS + policies
do $do$
declare
  has_orders boolean;
  col_exists boolean;
  read_expr text := 'public.is_beezio_admin_safe()';
begin
  if to_regclass('public.transactions') is null then
    return;
  end if;

  execute 'alter table public.transactions enable row level security';

  -- Service role full access
  execute 'drop policy if exists "service role can access transactions" on public.transactions';
  execute 'create policy "service role can access transactions" on public.transactions for all to service_role using (true) with check (true)';

  -- Authenticated READ: participants in the linked order (plus admin).
  execute 'drop policy if exists "transactions_select_participant_or_admin" on public.transactions';

  has_orders := (to_regclass('public.orders') is not null);
  if has_orders then
    -- buyer_id
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'buyer_id'
    ) into col_exists;
    if col_exists then
      read_expr := read_expr || ' OR exists (select 1 from public.orders o where o.id = transactions.order_id and public.is_profile_owner(o.buyer_id))';
    end if;

    -- user_id (legacy buyer)
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'user_id'
    ) into col_exists;
    if col_exists then
      read_expr := read_expr || ' OR exists (select 1 from public.orders o where o.id = transactions.order_id and public.is_profile_owner(o.user_id))';
    end if;

    -- seller_id
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'seller_id'
    ) into col_exists;
    if col_exists then
      read_expr := read_expr || ' OR exists (select 1 from public.orders o where o.id = transactions.order_id and public.is_profile_owner(o.seller_id))';
    end if;

    -- partner_id
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'partner_id'
    ) into col_exists;
    if col_exists then
      read_expr := read_expr || ' OR exists (select 1 from public.orders o where o.id = transactions.order_id and public.is_profile_owner(o.partner_id))';
    end if;

    -- influencer_id
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'influencer_id'
    ) into col_exists;
    if col_exists then
      read_expr := read_expr || ' OR exists (select 1 from public.orders o where o.id = transactions.order_id and public.is_profile_owner(o.influencer_id))';
    end if;

    -- affiliate_id / referrer_id / fundraiser_id (if present)
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'affiliate_id'
    ) into col_exists;
    if col_exists then
      read_expr := read_expr || ' OR exists (select 1 from public.orders o where o.id = transactions.order_id and public.is_profile_owner(o.affiliate_id))';
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'referrer_id'
    ) into col_exists;
    if col_exists then
      read_expr := read_expr || ' OR exists (select 1 from public.orders o where o.id = transactions.order_id and public.is_profile_owner(o.referrer_id))';
    end if;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'orders' and column_name = 'fundraiser_id'
    ) into col_exists;
    if col_exists then
      read_expr := read_expr || ' OR exists (select 1 from public.orders o where o.id = transactions.order_id and public.is_profile_owner(o.fundraiser_id))';
    end if;
  end if;

  execute 'create policy "transactions_select_participant_or_admin" on public.transactions for select to authenticated using (' || read_expr || ')';

  -- Authenticated WRITE: admin only (service role is already full access).
  execute 'drop policy if exists "transactions_admin_write" on public.transactions';
  execute 'create policy "transactions_admin_write" on public.transactions for all to authenticated using (public.is_beezio_admin_safe()) with check (public.is_beezio_admin_safe())';
end;
$do$;
