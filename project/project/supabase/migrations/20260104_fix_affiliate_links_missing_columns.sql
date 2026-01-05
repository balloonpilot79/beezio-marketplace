-- Fix production/test schema drift for affiliate_links
-- Some deployments have affiliate_links but missing columns used by referral tracking.
-- Safe to run multiple times.

do $$
begin
  if to_regclass('public.affiliate_links') is null then
    -- No-op if the table doesn't exist in this deployment.
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_links' and column_name = 'referral_code'
  ) then
    alter table public.affiliate_links add column referral_code text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_links' and column_name = 'link_code'
  ) then
    alter table public.affiliate_links add column link_code text;
  end if;

  -- Optional indexes for lookups (non-unique to avoid breaking existing data).
  begin
    execute 'create index if not exists idx_affiliate_links_referral_code on public.affiliate_links (referral_code)';
  exception when others then
    -- ignore
  end;

  begin
    execute 'create index if not exists idx_affiliate_links_link_code on public.affiliate_links (link_code)';
  exception when others then
    -- ignore
  end;
end;
$$;

