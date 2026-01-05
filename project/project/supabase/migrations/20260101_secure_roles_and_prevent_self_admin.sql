-- Secure role assignment & prevent self-admin escalation
-- - Blocks users from granting themselves `admin` via `user_roles` or `profiles`
-- - Ensures `profiles.primary_role` can only be set to an active role in `user_roles`
-- - Revokes public EXECUTE on security definer role helper functions created earlier
-- Safe to run multiple times.

create or replace function public.is_beezio_admin_email_allowlisted()
returns boolean
language plpgsql
stable
as $$
declare
  email_claim text;
  jwt jsonb;
begin
  begin
    email_claim := lower(coalesce(current_setting('request.jwt.claim.email', true), ''));
  exception
    when others then email_claim := '';
  end;

  if email_claim = '' then
    begin
      jwt := auth.jwt();
      email_claim := lower(coalesce(jwt->>'email', ''));
    exception
      when others then email_claim := '';
    end;
  end if;

  return email_claim in ('jason@beezio.co', 'jasonlovingsr@gmail.com');
end;
$$;

-- ============================
-- 1) Harden user_roles policies
-- ============================
do $do$
begin
  if to_regclass('public.user_roles') is null then
    return;
  end if;

  execute 'alter table public.user_roles enable row level security';

  execute 'drop policy if exists "Users can read own roles" on public.user_roles';
  execute 'drop policy if exists "Users can insert own roles" on public.user_roles';
  execute 'drop policy if exists "Users can update own roles" on public.user_roles';
  execute 'drop policy if exists "Admins can manage all roles" on public.user_roles';

  execute $pol$
    create policy "Users can read own roles"
      on public.user_roles
      for select
      to authenticated
      using (auth.uid() = user_id)
  $pol$;

  -- Allow self-serve creator roles, but prevent self-admin.
  execute $pol$
    create policy "Users can insert own non-admin roles"
      on public.user_roles
      for insert
      to authenticated
      with check (
        auth.uid() = user_id
        and role in ('buyer','seller','affiliate','fundraiser')
      )
  $pol$;

  execute $pol$
    create policy "Users can update own non-admin roles"
      on public.user_roles
      for update
      to authenticated
      using (
        auth.uid() = user_id
        and role in ('buyer','seller','affiliate','fundraiser')
      )
      with check (
        auth.uid() = user_id
        and role in ('buyer','seller','affiliate','fundraiser')
      )
  $pol$;

  -- Admin can manage all roles (including admin role) if allowlisted by email.
  execute $pol$
    create policy "Admins can manage all roles"
      on public.user_roles
      for all
      to authenticated
      using (public.is_beezio_admin_email_allowlisted())
      with check (public.is_beezio_admin_email_allowlisted())
  $pol$;
end;
$do$;

-- ==================================
-- 2) Harden profiles insert/update RLS
-- ==================================
do $do$
declare
  has_role boolean;
  has_primary_role boolean;
  role_check text;
  primary_role_check text;
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;

  -- Only reference optional columns if they exist (schemas vary).
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ) into has_role;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'primary_role'
  ) into has_primary_role;

  role_check := case
    when has_role then '(lower(coalesce(role::text, '''')) <> ''admin'' or public.is_beezio_admin_email_allowlisted())'
    else 'true'
  end;

  primary_role_check := case
    when has_primary_role then '(lower(coalesce(primary_role::text, '''')) <> ''admin'' or public.is_beezio_admin_email_allowlisted())'
    else 'true'
  end;

  execute 'alter table public.profiles enable row level security';

  -- Replace the common policies with versions that prevent self-admin.
  execute 'drop policy if exists "Users can insert own profile" on public.profiles';
  execute 'drop policy if exists "Users can update own profile" on public.profiles';

  execute format($pol$
    create policy "Users can insert own profile"
      on public.profiles
      for insert
      to authenticated
      with check (
        auth.uid() = user_id
        and %s
        and %s
      )
  $pol$, role_check, primary_role_check);

  execute format($pol$
    create policy "Users can update own profile"
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (
        auth.uid() = user_id
        and %s
        and %s
      )
  $pol$, role_check, primary_role_check);
end;
$do$;

-- ======================================================
-- 3) Enforce primary_role must be an active user_roles row
-- ======================================================
do $do$
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'primary_role'
  ) then
    return;
  end if;

  -- Create the trigger function only when primary_role exists.
  execute $fn$
    create or replace function public.enforce_primary_role_is_granted()
    returns trigger
    language plpgsql
    as $$
    begin
      if tg_op <> 'UPDATE' then
        return new;
      end if;

      if new.primary_role is null or new.primary_role = old.primary_role then
        return new;
      end if;

      if to_regclass('public.user_roles') is null then
        return new;
      end if;

      if not exists (
        select 1
        from public.user_roles ur
        where ur.user_id = new.user_id
          and ur.role = new.primary_role
          and ur.is_active = true
      ) then
        raise exception 'primary_role "%" is not an active granted role for this user', new.primary_role;
      end if;

      return new;
    end;
    $$;
  $fn$;

  execute 'drop trigger if exists enforce_primary_role_is_granted on public.profiles';
  execute 'create trigger enforce_primary_role_is_granted before update on public.profiles for each row execute function public.enforce_primary_role_is_granted()';
end;
$do$;

-- ==========================================
-- 4) Revoke public execute on role helper RPCs
-- ==========================================
do $do$
begin
  if to_regprocedure('public.add_user_role(uuid,text)') is not null then
    execute 'revoke execute on function public.add_user_role(uuid,text) from public';
  end if;
  if to_regprocedure('public.switch_primary_role(uuid,text)') is not null then
    execute 'revoke execute on function public.switch_primary_role(uuid,text) from public';
  end if;
  if to_regprocedure('public.get_user_roles(uuid)') is not null then
    execute 'revoke execute on function public.get_user_roles(uuid) from public';
  end if;
  if to_regprocedure('public.user_has_role(uuid,text)') is not null then
    execute 'revoke execute on function public.user_has_role(uuid,text) from public';
  end if;
end;
$do$;
