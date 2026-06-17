-- Custom store bootstrap hardening.
--
-- Every profile should have a default seller store row and a default affiliate
-- store row. This keeps storefront links working even when client-side signup
-- store creation is skipped, blocked by RLS, or races with profile creation.

create or replace function public.normalize_store_slug_for_bootstrap(value text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')),
    ''
  )
$$;

create or replace function public.unique_store_slug_for_bootstrap(
  p_base text,
  p_table text,
  p_owner_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := left(coalesce(public.normalize_store_slug_for_bootstrap(p_base), 'store'), 32);
  v_slug text;
  v_suffix integer := 0;
  v_exists boolean := false;
begin
  if length(v_base) < 3 then
    v_base := 'store-' || v_base;
  end if;

  loop
    v_slug := case
      when v_suffix = 0 then left(v_base, 32)
      else left(v_base, greatest(3, 32 - length('-' || v_suffix::text))) || '-' || v_suffix::text
    end;

    if p_table = 'affiliate_store_settings' then
      select exists (
        select 1
        from public.affiliate_store_settings
        where subdomain = v_slug
          and affiliate_id <> p_owner_id
      ) into v_exists;
    else
      select exists (
        select 1
        from public.store_settings
        where subdomain = v_slug
          and seller_id <> p_owner_id
      ) into v_exists;
    end if;

    if not v_exists then
      return v_slug;
    end if;

    v_suffix := v_suffix + 1;
  end loop;
end;
$$;

create or replace function public.ensure_default_custom_stores_for_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_email text;
  v_name text;
  v_slug_base text;
begin
  select *
  into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    return;
  end if;

  if auth.uid() is not null
    and v_profile.user_id is distinct from auth.uid()
    and v_profile.id is distinct from auth.uid()
  then
    raise exception 'Not allowed to bootstrap stores for this profile';
  end if;

  select email
  into v_email
  from auth.users
  where id = v_profile.user_id;

  v_name := coalesce(nullif(v_profile.full_name, ''), nullif(split_part(coalesce(v_email, v_profile.email, ''), '@', 1), ''), 'My Store');
  v_slug_base := coalesce(nullif(split_part(coalesce(v_email, v_profile.email, ''), '@', 1), ''), v_name, p_profile_id::text);

  if to_regclass('public.store_settings') is not null then
    insert into public.store_settings (
      seller_id,
      store_name,
      store_description,
      store_theme,
      subdomain,
      created_at,
      updated_at
    )
    values (
      p_profile_id,
      v_name,
      null,
      'modern',
      public.unique_store_slug_for_bootstrap(v_slug_base, 'store_settings', p_profile_id),
      now(),
      now()
    )
    on conflict (seller_id) do update
      set store_name = coalesce(public.store_settings.store_name, excluded.store_name),
          subdomain = coalesce(public.store_settings.subdomain, excluded.subdomain),
          updated_at = now();
  end if;

  if to_regclass('public.affiliate_store_settings') is not null then
    insert into public.affiliate_store_settings (
      affiliate_id,
      store_name,
      store_description,
      store_theme,
      subdomain,
      is_active,
      created_at,
      updated_at
    )
    values (
      p_profile_id,
      v_name,
      null,
      'modern',
      public.unique_store_slug_for_bootstrap(v_slug_base, 'affiliate_store_settings', p_profile_id),
      true,
      now(),
      now()
    )
    on conflict (affiliate_id) do update
      set store_name = coalesce(public.affiliate_store_settings.store_name, excluded.store_name),
          subdomain = coalesce(public.affiliate_store_settings.subdomain, excluded.subdomain),
          is_active = coalesce(public.affiliate_store_settings.is_active, true),
          updated_at = now();
  end if;
end;
$$;

create or replace function public.ensure_default_custom_stores_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.ensure_default_custom_stores_for_profile(new.id);
  return new;
end;
$$;

drop trigger if exists trigger_ensure_default_custom_stores on public.profiles;
create trigger trigger_ensure_default_custom_stores
  after insert on public.profiles
  for each row
  execute function public.ensure_default_custom_stores_for_new_profile();

do $$
declare
  v_profile record;
begin
  for v_profile in select id from public.profiles loop
    perform public.ensure_default_custom_stores_for_profile(v_profile.id);
  end loop;
end $$;

revoke all on function public.normalize_store_slug_for_bootstrap(text) from public;
revoke all on function public.unique_store_slug_for_bootstrap(text, text, uuid) from public;
revoke all on function public.ensure_default_custom_stores_for_profile(uuid) from public;
revoke all on function public.ensure_default_custom_stores_for_new_profile() from public;

grant execute on function public.ensure_default_custom_stores_for_profile(uuid) to service_role;
grant execute on function public.ensure_default_custom_stores_for_profile(uuid) to authenticated;
