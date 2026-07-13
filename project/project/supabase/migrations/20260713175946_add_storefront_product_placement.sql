-- One storefront per profile: collections and placements organize the single
-- underlying seller/affiliate catalog without duplicating products.

create table if not exists public.store_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_collections_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint store_collections_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint store_collections_owner_slug_key unique (owner_id, slug)
);

create table if not exists public.store_product_placements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  placement_type text not null,
  collection_id uuid references public.store_collections(id) on delete cascade,
  custom_page_id uuid references public.custom_pages(id) on delete cascade,
  section_key text,
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_product_placements_type_check
    check (placement_type in ('collection', 'page', 'homepage')),
  constraint store_product_placements_destination_check
    check (
      (placement_type = 'collection' and collection_id is not null and custom_page_id is null and section_key is null)
      or (placement_type = 'page' and custom_page_id is not null and collection_id is null and section_key is null)
      or (placement_type = 'homepage' and collection_id is null and custom_page_id is null and section_key is not null)
    )
);

create unique index if not exists store_product_placements_collection_key
  on public.store_product_placements(owner_id, product_id, collection_id)
  where placement_type = 'collection';

create unique index if not exists store_product_placements_page_key
  on public.store_product_placements(owner_id, product_id, custom_page_id)
  where placement_type = 'page';

create unique index if not exists store_product_placements_homepage_key
  on public.store_product_placements(owner_id, product_id, section_key)
  where placement_type = 'homepage';

create index if not exists store_collections_owner_order_idx
  on public.store_collections(owner_id, display_order, id);

create index if not exists store_product_placements_owner_product_idx
  on public.store_product_placements(owner_id, product_id);

create index if not exists store_product_placements_collection_order_idx
  on public.store_product_placements(collection_id, display_order, product_id)
  where placement_type = 'collection' and is_visible = true;

create index if not exists store_product_placements_page_order_idx
  on public.store_product_placements(custom_page_id, display_order, product_id)
  where placement_type = 'page' and is_visible = true;

alter table public.store_collections enable row level security;
alter table public.store_product_placements enable row level security;

drop policy if exists "Owners manage store collections" on public.store_collections;
create policy "Owners manage store collections"
  on public.store_collections
  for all
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = store_collections.owner_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = store_collections.owner_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Public reads visible store collections" on public.store_collections;
create policy "Public reads visible store collections"
  on public.store_collections
  for select
  to anon, authenticated
  using (is_visible = true);

drop policy if exists "Owners manage product placements" on public.store_product_placements;
create policy "Owners manage product placements"
  on public.store_product_placements
  for all
  to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = store_product_placements.owner_id
        and p.user_id = (select auth.uid())
    )
  )
  with check (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = store_product_placements.owner_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Public reads visible product placements" on public.store_product_placements;
create policy "Public reads visible product placements"
  on public.store_product_placements
  for select
  to anon, authenticated
  using (is_visible = true);

grant select on public.store_collections to anon;
grant select, insert, update, delete on public.store_collections to authenticated;
grant select on public.store_product_placements to anon;
grant select, insert, update, delete on public.store_product_placements to authenticated;

-- Prevent a placement from pointing at another profile's collection/page.
create or replace function public.validate_store_product_placement_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.placement_type = 'collection' and not exists (
    select 1 from public.store_collections c
    where c.id = new.collection_id and c.owner_id = new.owner_id
  ) then
    raise exception 'Collection does not belong to this storefront';
  end if;

  if new.placement_type = 'page' and not exists (
    select 1 from public.custom_pages p
    where p.id = new.custom_page_id and p.owner_id = new.owner_id
  ) then
    raise exception 'Page does not belong to this storefront';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_store_product_placement_owner() from public, anon, authenticated;

drop trigger if exists validate_store_product_placement_owner_trigger
  on public.store_product_placements;
create trigger validate_store_product_placement_owner_trigger
  before insert or update on public.store_product_placements
  for each row execute function public.validate_store_product_placement_owner();
