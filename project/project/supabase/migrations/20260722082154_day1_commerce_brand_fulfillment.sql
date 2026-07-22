-- Keep fulfillment records readable even after a product or storefront is edited.
alter table public.order_items
  add column if not exists product_title_snapshot text,
  add column if not exists product_description_snapshot text,
  add column if not exists product_sku_snapshot text,
  add column if not exists brand_name_snapshot text,
  add column if not exists storefront_id_snapshot uuid,
  add column if not exists image_url_snapshot text,
  add column if not exists source_url_snapshot text;

create index if not exists order_items_storefront_snapshot_idx
  on public.order_items(storefront_id_snapshot);

create or replace function public.capture_order_item_fulfillment_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_description text;
  v_product_sku text;
  v_product_image text;
  v_source_url text;
  v_variant_sku text;
  v_variant_image text;
  v_storefront_id uuid;
  v_brand_name text;
begin
  if new.product_id is not null then
    select
      p.title,
      p.description,
      p.vendor_sku,
      coalesce(p.primary_image_url, p.images[1]),
      p.source_url
    into v_title, v_description, v_product_sku, v_product_image, v_source_url
    from public.products p
    where p.id = new.product_id;
  end if;

  if new.variant_id is not null then
    select pv.sku, pv.image_url
    into v_variant_sku, v_variant_image
    from public.product_variants pv
    where pv.id = new.variant_id;
  end if;

  if new.order_id is not null then
    select o.storefront_id, s.name
    into v_storefront_id, v_brand_name
    from public.orders o
    left join public.storefronts s on s.id = o.storefront_id
    where o.id = new.order_id;
  end if;

  new.product_title_snapshot := coalesce(new.product_title_snapshot, v_title, 'Product');
  new.product_description_snapshot := coalesce(new.product_description_snapshot, v_description);
  new.product_sku_snapshot := coalesce(new.product_sku_snapshot, new.sku, v_variant_sku, v_product_sku);
  new.storefront_id_snapshot := coalesce(new.storefront_id_snapshot, v_storefront_id);
  new.brand_name_snapshot := coalesce(new.brand_name_snapshot, v_brand_name);
  new.image_url_snapshot := coalesce(new.image_url_snapshot, v_variant_image, v_product_image);
  new.source_url_snapshot := coalesce(new.source_url_snapshot, v_source_url);
  return new;
end;
$$;

revoke all on function public.capture_order_item_fulfillment_snapshot() from public, anon, authenticated;

drop trigger if exists capture_order_item_fulfillment_snapshot on public.order_items;
create trigger capture_order_item_fulfillment_snapshot
before insert or update of product_id, variant_id, order_id on public.order_items
for each row execute function public.capture_order_item_fulfillment_snapshot();

-- Re-touch legacy rows so the trigger fills only their currently empty snapshots.
update public.order_items
set product_id = product_id
where product_title_snapshot is null
   or brand_name_snapshot is null
   or product_sku_snapshot is null;

-- Product selections create storefront placement for ordinary one-store accounts.
-- Multi-brand admins continue choosing a specific storefront in Product Hub.
alter table public.storefront_products
  add column if not exists placement_source text not null default 'manual',
  add column if not exists source_owner_id uuid;

delete from public.storefront_products older
using public.storefront_products newer
where older.storefront_id = newer.storefront_id
  and older.product_id = newer.product_id
  and older.ctid < newer.ctid;

create unique index if not exists storefront_products_storefront_product_release_key
  on public.storefront_products(storefront_id, product_id);

create index if not exists storefront_products_source_owner_idx
  on public.storefront_products(source_owner_id, placement_source, product_id);

create or replace function public.sync_selected_product_to_single_storefront()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_product_id uuid;
  v_position integer;
  v_source text;
  v_storefront_count integer;
begin
  if tg_table_name = 'affiliate_products' and tg_op = 'DELETE' then
    v_owner_id := old.affiliate_id;
    v_product_id := old.product_id;
    v_position := coalesce(old.display_order, 0);
    v_source := 'affiliate_selection';
  elsif tg_table_name = 'affiliate_products' then
    v_owner_id := new.affiliate_id;
    v_product_id := new.product_id;
    v_position := coalesce(new.display_order, 0);
    v_source := 'affiliate_selection';
  elsif tg_op = 'DELETE' then
    v_owner_id := old.seller_id;
    v_product_id := old.product_id;
    v_position := coalesce(old.display_order, 0);
    v_source := 'seller_selection';
  else
    v_owner_id := new.seller_id;
    v_product_id := new.product_id;
    v_position := coalesce(new.display_order, 0);
    v_source := 'seller_selection';
  end if;

  if v_owner_id is null or v_product_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    delete from public.storefront_products sp
    where sp.product_id = v_product_id
      and sp.source_owner_id = v_owner_id
      and sp.placement_source = v_source;
    return old;
  end if;

  select count(*)
  into v_storefront_count
  from public.storefronts s
  where s.owner_id = v_owner_id
    and s.is_active = true;

  if v_storefront_count = 1 then
    insert into public.storefront_products (
      storefront_id,
      product_id,
      position,
      placement_source,
      source_owner_id
    )
    select s.id, v_product_id, v_position, v_source, v_owner_id
    from public.storefronts s
    where s.owner_id = v_owner_id
      and s.is_active = true
    on conflict (storefront_id, product_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_selected_product_to_single_storefront() from public, anon, authenticated;

drop trigger if exists affiliate_products_sync_storefront on public.affiliate_products;
create trigger affiliate_products_sync_storefront
after insert or delete on public.affiliate_products
for each row execute function public.sync_selected_product_to_single_storefront();

drop trigger if exists seller_products_sync_storefront on public.seller_product_order;
create trigger seller_products_sync_storefront
after insert or delete on public.seller_product_order
for each row execute function public.sync_selected_product_to_single_storefront();

-- Third protected brand under the temporary shared Beezio administrator.
insert into public.storefronts (
  owner_id,
  type,
  name,
  slug,
  logo_url,
  description,
  theme_settings,
  color_scheme,
  store_theme,
  is_active,
  shipping_policy,
  return_policy
)
select
  p.id,
  'seller'::public.storefront_type,
  'Loving Nutrition',
  'loving-nutrition',
  '/loving-nutrition-logo.png',
  'Thoughtful nutrition and wellness products selected to help everyday routines feel healthier and easier.',
  jsonb_build_object(
    'primaryColor', '#166534',
    'secondaryColor', '#d4a72c',
    'accentColor', '#dc2626',
    'personality', 'nutrition-wellness'
  ),
  jsonb_build_object(
    'primary', '#166534',
    'secondary', '#d4a72c',
    'accent', '#dc2626',
    'background', '#fffdf7'
  ),
  'editorial',
  true,
  'Shipping is itemized at checkout. Orders are currently fulfilled manually with tracking added after shipment.',
  'Contact Loving Nutrition through Beezio support for return eligibility and instructions.'
from public.profiles p
where lower(trim(p.email)) = 'jasonlovingsr@gmail.com'
order by p.created_at asc
limit 1
on conflict (slug) do update
set
  owner_id = excluded.owner_id,
  name = excluded.name,
  logo_url = excluded.logo_url,
  description = excluded.description,
  theme_settings = excluded.theme_settings,
  color_scheme = excluded.color_scheme,
  store_theme = excluded.store_theme,
  is_active = true,
  shipping_policy = excluded.shipping_policy,
  return_policy = excluded.return_policy,
  updated_at = now();

-- Manual launch mode: paid orders stay in the Beezio fulfillment queue.
drop trigger if exists automated_fulfillment_trigger on public.orders;

-- The review-and-approve workflow prepares payout items before PayPal submission.
alter type public.payout_item_status add value if not exists 'PREPARED' before 'CREATED';

comment on column public.order_items.product_title_snapshot is
  'Immutable checkout-time title used by fulfillment and audit reports.';
comment on column public.order_items.brand_name_snapshot is
  'Immutable checkout-time storefront/brand name used by fulfillment.';
comment on column public.storefront_products.placement_source is
  'manual, seller_selection, or affiliate_selection; selection rows can be removed without deleting manual brand placement.';

notify pgrst, 'reload schema';
