-- Triple-check gate for SupplyLine Plus / CJ catalog activation.
-- CJ products are imported draft-first and cannot become live/promotable until
-- their exact product identity, every VID/SKU mapping, live freight data, media,
-- and SupplyLine Plus placement are present and internally consistent.

alter table public.products
  add column if not exists source text,
  add column if not exists dropship_provider text,
  add column if not exists is_dropshipped boolean not null default false,
  add column if not exists lineage text,
  add column if not exists sku text,
  add column if not exists external_variant_id text,
  add column if not exists inventory_source text,
  add column if not exists cj_pid text,
  add column if not exists cj_product_code text,
  add column if not exists cj_product_sku text,
  add column if not exists cj_spu text,
  add column if not exists cj_name_raw text,
  add column if not exists cj_source_payload_json jsonb not null default '{}'::jsonb,
  add column if not exists searchable_codes text[] not null default '{}'::text[],
  add column if not exists import_status text not null default 'ready',
  add column if not exists display_search_code text,
  add column if not exists source_import_version text,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verified_at timestamptz,
  add column if not exists verification_details jsonb not null default '{}'::jsonb;

create index if not exists products_source_platform_idx on public.products (source_platform);
create index if not exists products_cj_pid_idx on public.products (cj_pid) where cj_pid is not null;
create index if not exists products_cj_product_sku_idx on public.products (cj_product_sku) where cj_product_sku is not null;

create schema if not exists beezio_private;
revoke all on schema beezio_private from public, anon, authenticated;

create or replace function beezio_private.enforce_cj_product_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  variant_count integer := 0;
  distinct_vid_count integer := 0;
  invalid_variant_count integer := 0;
  mapping_count integer := 0;
  mapping_mismatch_count integer := 0;
  product_mapping_ok boolean := false;
  storefront_ok boolean := false;
  identity_ok boolean := false;
  image_count integer := 0;
  bad_image_count integer := 0;
  bad_video_count integer := 0;
  reasons text[] := '{}'::text[];
begin
  if lower(coalesce(new.source_platform, '')) <> 'cj'
     and lower(coalesce(new.source, '')) <> 'cj'
     and lower(coalesce(new.dropship_provider, '')) <> 'cj' then
    return new;
  end if;

  if coalesce(new.is_active, false) = false
     and lower(coalesce(new.status, 'draft')) <> 'active' then
    if coalesce(new.verification_status, '') = '' then
      new.verification_status := 'pending';
    end if;
    return new;
  end if;

  select
    count(*)::integer,
    count(distinct nullif(btrim(pv.cj_vid), ''))::integer,
    count(*) filter (
      where nullif(btrim(pv.cj_vid), '') is null
         or nullif(btrim(pv.cj_variant_id), '') is null
         or nullif(btrim(pv.cj_variant_sku), '') is null
         or coalesce(pv.is_orderable, false) is not true
         or lower(coalesce(pv.order_reference_type, '')) <> 'cj_vid'
         or coalesce(pv.supplier_cost_amount, 0) <= 0
         or coalesce(pv.calculated_customer_price, 0) <= 0
         or coalesce(pv.shipping_reserve_amount, -1) < 0
         or nullif(btrim(pv.cj_freight_method), '') is null
         or upper(coalesce(pv.cj_freight_destination_country, '')) <> 'US'
         or pv.cj_freight_quoted_at is null
         or pv.cj_price_verified_at is null
         or nullif(btrim(pv.image_url), '') is null
         or pv.image_url !~* '^https://'
         or lower(coalesce(pv.import_status, '')) = 'needs_review'
    )::integer
  into variant_count, distinct_vid_count, invalid_variant_count
  from public.product_variants pv
  where pv.product_id = new.id
    and (
      lower(coalesce(pv.source_platform, '')) = 'cj'
      or lower(coalesce(pv.source, '')) = 'cj'
      or lower(coalesce(pv.provider, '')) = 'cj'
    );

  select
    count(cvm.id)::integer,
    count(*) filter (
      where cvm.id is null
         or nullif(btrim(cvm.cj_vid), '') is null
         or cvm.cj_vid is distinct from pv.cj_vid
         or (
           nullif(btrim(pv.cj_variant_sku), '') is not null
           and nullif(btrim(cvm.cj_variant_sku), '') is distinct from nullif(btrim(pv.cj_variant_sku), '')
         )
         or cvm.cj_product_id is distinct from new.cj_product_id
         or coalesce(cvm.supplier_cost_amount, -1) < 0
         or abs(coalesce(cvm.supplier_cost_amount, -1) - coalesce(pv.supplier_cost_amount, -2)) > 0.01
         or coalesce(cvm.freight_cost_amount, -1) < 0
         or abs(coalesce(cvm.freight_cost_amount, -1) - coalesce(pv.shipping_reserve_amount, -2)) > 0.01
         or upper(coalesce(cvm.freight_destination_country, '')) <> 'US'
         or cvm.freight_quoted_at is null
         or cvm.price_verified_at is null
         or coalesce(cvm.is_active, false) is not true
    )::integer
  into mapping_count, mapping_mismatch_count
  from public.product_variants pv
  left join public.cj_variant_mappings cvm
    on cvm.product_variant_id = pv.id
  where pv.product_id = new.id
    and (
      lower(coalesce(pv.source_platform, '')) = 'cj'
      or lower(coalesce(pv.source, '')) = 'cj'
      or lower(coalesce(pv.provider, '')) = 'cj'
    );

  select exists (
    select 1
    from public.cj_product_mappings pm
    where pm.beezio_product_id = new.id
      and pm.cj_product_id = new.cj_product_id
      and lower(coalesce(pm.price_breakdown -> 'verification' ->> 'verified', 'false')) in ('true','t','1','yes')
      and nullif(btrim(pm.cj_product_sku), '') is not null
  ) into product_mapping_ok;

  select exists (
    select 1
    from public.storefront_products sp
    join public.storefronts s on s.id = sp.storefront_id
    where sp.product_id = new.id
      and s.slug = 'supplyline-plus'
      and coalesce(s.is_active, false) is true
  ) into storefront_ok;

  identity_ok :=
    nullif(btrim(new.cj_product_id), '') is not null
    and nullif(btrim(new.cj_pid), '') is not null
    and coalesce(
      nullif(btrim(new.cj_product_sku), ''),
      nullif(btrim(new.cj_product_code), ''),
      nullif(btrim(new.cj_spu), '')
    ) is not null
    and lower(coalesce(new.import_status, 'ready')) <> 'needs_review';

  image_count := coalesce(cardinality(new.images), 0);
  select count(*)::integer
  into bad_image_count
  from unnest(coalesce(new.images, '{}'::text[])) as u(url)
  where nullif(btrim(url), '') is null
     or url !~* '^https://'
     or lower(url) like '%cjdropshipping.com%'
     or lower(url) like '%aliyuncs.com%';

  select count(*)::integer
  into bad_video_count
  from unnest(coalesce(new.videos, '{}'::text[])) as u(url)
  where nullif(btrim(url), '') is null
     or url !~* '^https://'
     or lower(url) like '%cjdropshipping.com%'
     or lower(url) like '%aliyuncs.com%';

  if not identity_ok then reasons := array_append(reasons, 'product_identity'); end if;
  if variant_count <= 0 then reasons := array_append(reasons, 'no_cj_variants'); end if;
  if distinct_vid_count <> variant_count then reasons := array_append(reasons, 'duplicate_or_missing_vid'); end if;
  if invalid_variant_count > 0 then reasons := array_append(reasons, 'invalid_variant_contract'); end if;
  if mapping_count <> variant_count then reasons := array_append(reasons, 'variant_mapping_count'); end if;
  if mapping_mismatch_count > 0 then reasons := array_append(reasons, 'variant_mapping_mismatch'); end if;
  if not product_mapping_ok then reasons := array_append(reasons, 'product_mapping_unverified'); end if;
  if not storefront_ok then reasons := array_append(reasons, 'supplyline_plus_placement'); end if;
  if image_count <= 0 or bad_image_count > 0 then reasons := array_append(reasons, 'product_images'); end if;
  if bad_video_count > 0 then reasons := array_append(reasons, 'product_videos'); end if;

  new.verification_details := jsonb_build_object(
    'checked_at', now(),
    'variant_count', variant_count,
    'distinct_vid_count', distinct_vid_count,
    'invalid_variant_count', invalid_variant_count,
    'variant_mapping_count', mapping_count,
    'variant_mapping_mismatch_count', mapping_mismatch_count,
    'product_mapping_verified', product_mapping_ok,
    'supplyline_plus_placed', storefront_ok,
    'image_count', image_count,
    'bad_image_count', bad_image_count,
    'video_count', coalesce(cardinality(new.videos), 0),
    'bad_video_count', bad_video_count,
    'reasons', to_jsonb(reasons)
  );

  if cardinality(reasons) > 0 then
    new.is_active := false;
    new.is_promotable := false;
    new.status := 'draft';
    new.import_status := 'needs_review';
    new.verification_status := 'failed';
    new.verified_at := null;
  else
    new.is_active := true;
    new.is_promotable := true;
    new.status := 'active';
    new.import_status := 'ready';
    new.verification_status := 'verified';
    new.verified_at := now();
  end if;

  return new;
end;
$$;

revoke all on function beezio_private.enforce_cj_product_verification() from public, anon, authenticated;
grant execute on function beezio_private.enforce_cj_product_verification() to service_role;

drop trigger if exists products_cj_verified_activation_gate on public.products;
create trigger products_cj_verified_activation_gate
before insert or update of is_active, status, source_platform, source, dropship_provider, cj_product_id, images, videos
on public.products
for each row
execute function beezio_private.enforce_cj_product_verification();
