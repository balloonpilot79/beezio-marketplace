-- Seller and affiliate settings can represent one member store. A dedicated
-- storefront can also mirror those settings at the same owner and URL.
create extension if not exists btree_gist with schema extensions;
create schema beezio_store_names;

create function beezio_store_names.name_key(display_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(lower(btrim(regexp_replace(display_name, '[[:space:]]+', ' ', 'g'))), '');
$$;

create table beezio_store_names.claims (
  source_table text not null,
  source_id uuid not null,
  name_key text not null,
  owner_id uuid not null,
  store_group text not null,
  slug text not null,
  primary key (source_table, source_id),
  exclude using gist (name_key with =, owner_id with <>),
  exclude using gist (name_key with =, store_group with <>, slug with <>)
);

create unique index dedicated_store_name_key
  on beezio_store_names.claims (name_key) where store_group = 'dedicated';

alter table beezio_store_names.claims enable row level security;
revoke all on table beezio_store_names.claims from public, anon, authenticated;

-- Hold writes while copying existing names and attaching the triggers.
lock table public.store_settings, public.affiliate_store_settings, public.storefronts
  in share row exclusive mode;

insert into beezio_store_names.claims (source_table, source_id, name_key, owner_id, store_group, slug)
select source_table, id, beezio_store_names.name_key(display_name), owner_id, store_group, coalesce(slug, '')
from (
  select 'store_settings' as source_table, id, store_name as display_name, seller_id as owner_id,
    'member' as store_group, subdomain as slug from public.store_settings
  union all
  select 'affiliate_store_settings', id, store_name, affiliate_id, 'member', subdomain
  from public.affiliate_store_settings
  union all
  select 'storefronts', id, name, owner_id, 'dedicated', slug from public.storefronts
) existing
where beezio_store_names.name_key(display_name) is not null;

create function beezio_store_names.sync_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_owner uuid;
  v_slug text;
  v_group text := 'member';
begin
  if tg_op = 'DELETE' then
    delete from beezio_store_names.claims where source_table = tg_table_name and source_id = old.id;
    return old;
  end if;

  if tg_table_name = 'storefronts' then
    v_key := beezio_store_names.name_key(new.name);
    v_owner := new.owner_id;
    v_slug := new.slug;
    v_group := 'dedicated';
  else
    v_key := beezio_store_names.name_key(new.store_name);
    v_slug := new.subdomain;
    if tg_table_name = 'store_settings' then
      v_owner := new.seller_id;
    else
      v_owner := new.affiliate_id;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.id is distinct from new.id then
    delete from beezio_store_names.claims where source_table = tg_table_name and source_id = old.id;
  end if;

  if v_key is null then
    delete from beezio_store_names.claims where source_table = tg_table_name and source_id = new.id;
  else
    insert into beezio_store_names.claims (source_table, source_id, name_key, owner_id, store_group, slug)
    values (tg_table_name, new.id, v_key, v_owner, v_group, coalesce(v_slug, ''))
    on conflict (source_table, source_id) do update
      set name_key = excluded.name_key, owner_id = excluded.owner_id, slug = excluded.slug;
  end if;
  return new;
exception when exclusion_violation or unique_violation then
  raise exception using errcode = 'BZ001', message = 'That store name is already taken. Choose a different name.';
end;
$$;

revoke all on function beezio_store_names.sync_claim() from public, anon, authenticated;

create trigger sync_store_display_name
after insert or delete or update of id, seller_id, store_name, subdomain on public.store_settings
for each row execute function beezio_store_names.sync_claim();

create trigger sync_store_display_name
after insert or delete or update of id, affiliate_id, store_name, subdomain on public.affiliate_store_settings
for each row execute function beezio_store_names.sync_claim();

create trigger sync_store_display_name
after insert or delete or update of id, owner_id, name, slug on public.storefronts
for each row execute function beezio_store_names.sync_claim();

-- The signup check returns a boolean and exposes no store ownership data.
create function beezio_store_names.is_available(display_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select beezio_store_names.name_key(display_name) is not null and not exists (
    select 1 from beezio_store_names.claims
    where name_key = beezio_store_names.name_key(display_name)
  );
$$;

revoke all on function beezio_store_names.is_available(text) from public;
grant usage on schema beezio_store_names to anon, authenticated;
grant execute on function beezio_store_names.is_available(text) to anon, authenticated;

create function public.is_store_name_available(display_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select beezio_store_names.is_available(display_name);
$$;

revoke all on function public.is_store_name_available(text) from public;
grant execute on function public.is_store_name_available(text) to anon, authenticated;

-- Creating an account must still succeed when its automatic store name would
-- collide. Try the chosen name first and generate a distinct default if needed.
create or replace function public.ensure_default_custom_stores_for_profile(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_auth_user auth.users%rowtype;
  v_base_name text;
  v_slug_base text;
  v_name text;
  v_suffix integer := 0;
begin
  select * into v_profile from public.profiles where id = p_profile_id;
  if not found then
    return;
  end if;

  if auth.uid() is not null
    and v_profile.user_id is distinct from auth.uid()
    and v_profile.id is distinct from auth.uid()
  then
    raise exception 'Not allowed to bootstrap stores for this profile';
  end if;

  select * into v_auth_user from auth.users where id = v_profile.user_id;
  v_base_name := coalesce(
    nullif(btrim(v_auth_user.raw_user_meta_data->>'store_name'), ''),
    nullif(btrim(v_profile.full_name), ''),
    nullif(split_part(coalesce(v_auth_user.email, v_profile.email, ''), '@', 1), ''),
    'My Store'
  );
  v_slug_base := coalesce(
    nullif(btrim(v_auth_user.raw_user_meta_data->>'store_slug'), ''),
    nullif(split_part(coalesce(v_auth_user.email, v_profile.email, ''), '@', 1), ''),
    v_base_name
  );

  loop
    v_name := case when v_suffix = 0 then v_base_name else v_base_name || ' ' || (v_suffix + 1)::text end;
    begin
      insert into public.store_settings (seller_id, store_name, store_theme, subdomain)
      values (p_profile_id, v_name, 'modern', public.unique_store_slug_for_bootstrap(v_slug_base, 'store_settings', p_profile_id))
      on conflict (seller_id) do update
        set store_name = coalesce(public.store_settings.store_name, excluded.store_name),
            subdomain = coalesce(public.store_settings.subdomain, excluded.subdomain);

      insert into public.affiliate_store_settings (affiliate_id, store_name, store_theme, subdomain, is_active)
      values (p_profile_id, v_name, 'modern', public.unique_store_slug_for_bootstrap(v_slug_base, 'affiliate_store_settings', p_profile_id), true)
      on conflict (affiliate_id) do update
        set store_name = coalesce(public.affiliate_store_settings.store_name, excluded.store_name),
            subdomain = coalesce(public.affiliate_store_settings.subdomain, excluded.subdomain),
            is_active = coalesce(public.affiliate_store_settings.is_active, excluded.is_active);
      return;
    exception when sqlstate 'BZ001' then
      v_suffix := v_suffix + 1;
    end;
  end loop;
end;
$$;
