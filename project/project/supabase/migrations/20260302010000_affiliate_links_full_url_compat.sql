-- Ensure affiliate_links has modern URL fields used by share-link generation.
-- Safe to run multiple times.

do $$
begin
  if to_regclass('public.affiliate_links') is null then
    return;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliate_links'
      and column_name = 'full_url'
  ) then
    alter table public.affiliate_links add column full_url text;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliate_links'
      and column_name = 'custom_name'
  ) then
    alter table public.affiliate_links add column custom_name text;
  end if;
end;
$$;
