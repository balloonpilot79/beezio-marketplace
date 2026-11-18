begin;

-- Tokens are stored in the worker's secret environment, never in these tables.
create table public.facebook_share_attempts (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  product_id uuid not null,
  source text not null check (source in ('seller','affiliate')),
  status text not null default 'queued' check (status in ('queued','sending','published','unknown','rejected','skipped')),
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  started_at timestamptz,
  page_id text,
  facebook_post_id text,
  detail text
);
create index facebook_share_queue on public.facebook_share_attempts (created_at,id) where status='queued';
create table public.facebook_zip_locations (
  zip text not null check (zip ~ '^[0-9]{5}$'),
  state text not null, county text not null, town text not null default '',
  primary key (zip,state,county,town)
);
alter table public.facebook_share_attempts enable row level security;
alter table public.facebook_zip_locations enable row level security;
revoke all on public.facebook_share_attempts,public.facebook_zip_locations from public,anon,authenticated;
grant select,update on public.facebook_share_attempts to service_role;
grant select,insert,update,delete on public.facebook_zip_locations to service_role;

create function public.facebook_product_listed(row_data jsonb) returns boolean
language sql immutable as $$
 select lower(coalesce(row_data->>'status','')) not in ('draft','archived','deleted','inactive','pending','rejected')
 and coalesce((row_data->>'is_active')::boolean, lower(coalesce(row_data->>'status','active')) in ('active','published','available'))
$$;
create function public.facebook_enqueue_share() returns trigger
language plpgsql security definer set search_path = pg_catalog,public as $$
begin
  if tg_table_name='products' then
    if not public.facebook_product_listed(to_jsonb(new)) then return new; end if;
    if tg_op='UPDATE' and public.facebook_product_listed(to_jsonb(old)) then return new; end if;
    insert into public.facebook_share_attempts(actor_id,product_id,source) values(new.seller_id,new.id,'seller');
  else
    if coalesce(new.is_active,true)=false then return new; end if;
    if tg_op='UPDATE' and coalesce(old.is_active,true) then return new; end if;
    insert into public.facebook_share_attempts(actor_id,product_id,source) values(new.affiliate_id,new.product_id,'affiliate');
  end if;
  return new;
end $$;
revoke all on function public.facebook_enqueue_share() from public,anon,authenticated;
create trigger facebook_seller_listing after insert or update of status,is_active on public.products
for each row when (new.seller_id is not null) execute function public.facebook_enqueue_share();
create trigger facebook_affiliate_add after insert or update of is_active on public.affiliate_products
for each row when (new.affiliate_id is not null) execute function public.facebook_enqueue_share();

create function public.facebook_claim_share() returns setof public.facebook_share_attempts
language plpgsql security invoker as $$
begin
 update public.facebook_share_attempts set status='unknown',detail='Worker interrupted; reconcile with Page'
 where status='sending' and started_at < now() - interval '15 minutes';
 return query update public.facebook_share_attempts set status='sending',started_at=clock_timestamp()
 where id=(select id from public.facebook_share_attempts where status='queued' and available_at <= now()
 order by created_at,id for update skip locked limit 1)
 returning *;
end $$;
revoke all on function public.facebook_claim_share() from public,anon,authenticated;
grant execute on function public.facebook_claim_share() to service_role;
commit;
