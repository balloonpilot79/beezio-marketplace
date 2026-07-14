-- Multi-brand storefronts for one Beezio business account.
-- Keeps products, orders, conversations, and branding scoped to the storefront
-- while the owner retains one profile and one unified admin dashboard.

create or replace function public.is_beezio_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and (
        lower(coalesce(p.role, '')) = 'admin'
        or lower(coalesce(p.primary_role, '')) = 'admin'
        or exists (
          select 1 from public.user_roles ur
          where ur.user_id = (select auth.uid())
            and ur.role = 'admin'
            and ur.is_active = true
        )
      )
  );
$$;

revoke all on function public.is_beezio_admin() from public, anon;
grant execute on function public.is_beezio_admin() to authenticated;

alter table if exists public.storefronts
  add column if not exists description text,
  add column if not exists banner_url text,
  add column if not exists store_theme text default 'modern',
  add column if not exists product_page_template text,
  add column if not exists layout_config jsonb default '{}'::jsonb,
  add column if not exists color_scheme jsonb default '{}'::jsonb,
  add column if not exists social_links jsonb default '{}'::jsonb,
  add column if not exists business_hours text,
  add column if not exists shipping_policy text,
  add column if not exists return_policy text,
  add column if not exists custom_css text,
  add column if not exists is_active boolean not null default true;

create index if not exists storefronts_owner_active_idx
  on public.storefronts(owner_id, is_active, created_at);

alter table if exists public.storefronts enable row level security;
alter table if exists public.storefront_products enable row level security;

-- A product can appear only once in a given brand storefront. The restored
-- schema had a surrogate primary key but no business-key constraint, which
-- made safe upserts from the product form impossible.
delete from public.storefront_products duplicate
using public.storefront_products keeper
where duplicate.storefront_id = keeper.storefront_id
  and duplicate.product_id = keeper.product_id
  and duplicate.id > keeper.id;

create unique index if not exists storefront_products_storefront_product_key
  on public.storefront_products(storefront_id, product_id);

drop policy if exists "Public reads active storefronts" on public.storefronts;
create policy "Public reads active storefronts"
  on public.storefronts for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Owners manage storefronts" on public.storefronts;
create policy "Owners manage storefronts"
  on public.storefronts for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = storefronts.owner_id
        and p.user_id = (select auth.uid())
    )
    or public.is_beezio_admin()
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = storefronts.owner_id
        and p.user_id = (select auth.uid())
    )
    or public.is_beezio_admin()
  );

drop policy if exists "Public reads storefront products" on public.storefront_products;
create policy "Public reads storefront products"
  on public.storefront_products for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.storefronts s
      where s.id = storefront_products.storefront_id
        and s.is_active = true
    )
  );

drop policy if exists "Owners manage storefront products" on public.storefront_products;
create policy "Owners manage storefront products"
  on public.storefront_products for all
  to authenticated
  using (
    exists (
      select 1
      from public.storefronts s
      join public.profiles p on p.id = s.owner_id
      where s.id = storefront_products.storefront_id
        and p.user_id = (select auth.uid())
    )
    or public.is_beezio_admin()
  )
  with check (
    exists (
      select 1
      from public.storefronts s
      join public.profiles p on p.id = s.owner_id
      where s.id = storefront_products.storefront_id
        and p.user_id = (select auth.uid())
    )
    or public.is_beezio_admin()
  );

grant select on public.storefronts, public.storefront_products to anon;
grant select, insert, update, delete on public.storefronts, public.storefront_products to authenticated;

-- Messaging and support tables were missing from some restored databases.
create table if not exists public.store_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_type text not null check (owner_type in ('seller','affiliate','fundraiser')),
  customer_id uuid not null references auth.users(id) on delete cascade,
  store_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_conversation_participants (
  conversation_id uuid not null references public.store_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.store_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.store_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  status text not null default 'open' check (status in ('open','pending','closed')),
  assigned_admin_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_thread_participants (
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

alter table public.store_conversations enable row level security;
alter table public.store_conversation_participants enable row level security;
alter table public.store_messages enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_thread_participants enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "Store participants read conversations" on public.store_conversations;
create policy "Store participants read conversations" on public.store_conversations
  for select to authenticated
  using (owner_id = (select auth.uid()) or customer_id = (select auth.uid()) or public.is_beezio_admin());

drop policy if exists "Store participants create conversations" on public.store_conversations;
create policy "Store participants create conversations" on public.store_conversations
  for insert to authenticated
  with check (owner_id = (select auth.uid()) or customer_id = (select auth.uid()) or public.is_beezio_admin());

drop policy if exists "Participants read own markers" on public.store_conversation_participants;
create policy "Participants read own markers" on public.store_conversation_participants
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_beezio_admin());

drop policy if exists "Participants create own markers" on public.store_conversation_participants;
create policy "Participants create own markers" on public.store_conversation_participants
  for insert to authenticated
  with check (user_id = (select auth.uid()) or public.is_beezio_admin());

drop policy if exists "Participants update own markers" on public.store_conversation_participants;
create policy "Participants update own markers" on public.store_conversation_participants
  for update to authenticated
  using (user_id = (select auth.uid()) or public.is_beezio_admin())
  with check (user_id = (select auth.uid()) or public.is_beezio_admin());

drop policy if exists "Store participants read messages" on public.store_messages;
create policy "Store participants read messages" on public.store_messages
  for select to authenticated
  using (
    public.is_beezio_admin()
    or exists (
      select 1 from public.store_conversations c
      where c.id = store_messages.conversation_id
        and (c.owner_id = (select auth.uid()) or c.customer_id = (select auth.uid()))
    )
  );

drop policy if exists "Store participants send messages" on public.store_messages;
create policy "Store participants send messages" on public.store_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      public.is_beezio_admin()
      or exists (
        select 1 from public.store_conversations c
        where c.id = store_messages.conversation_id
          and (c.owner_id = (select auth.uid()) or c.customer_id = (select auth.uid()))
      )
    )
  );

drop policy if exists "Customers and admins read support threads" on public.support_threads;
create policy "Customers and admins read support threads" on public.support_threads
  for select to authenticated
  using (customer_id = (select auth.uid()) or public.is_beezio_admin());

drop policy if exists "Customers and admins create support threads" on public.support_threads;
create policy "Customers and admins create support threads" on public.support_threads
  for insert to authenticated
  with check (customer_id = (select auth.uid()) or public.is_beezio_admin());

drop policy if exists "Support markers belong to users" on public.support_thread_participants;
create policy "Support markers belong to users" on public.support_thread_participants
  for all to authenticated
  using (user_id = (select auth.uid()) or public.is_beezio_admin())
  with check (user_id = (select auth.uid()) or public.is_beezio_admin());

drop policy if exists "Customers and admins read support messages" on public.support_messages;
create policy "Customers and admins read support messages" on public.support_messages
  for select to authenticated
  using (
    public.is_beezio_admin()
    or exists (
      select 1 from public.support_threads t
      where t.id = support_messages.thread_id and t.customer_id = (select auth.uid())
    )
  );

drop policy if exists "Customers and admins send support messages" on public.support_messages;
create policy "Customers and admins send support messages" on public.support_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (
      public.is_beezio_admin()
      or exists (
        select 1 from public.support_threads t
        where t.id = support_messages.thread_id and t.customer_id = (select auth.uid())
      )
    )
  );

grant select, insert on public.store_conversations, public.store_messages, public.support_threads, public.support_messages to authenticated;
grant select, insert, update on public.store_conversation_participants, public.support_thread_participants to authenticated;

-- Every order and message keeps its brand identity even though multiple brands
-- can share the same seller/admin account.
alter table if exists public.store_conversations
  add column if not exists storefront_id uuid references public.storefronts(id) on delete set null;

create index if not exists store_conversations_storefront_idx
  on public.store_conversations(storefront_id, updated_at desc);

alter table if exists public.store_conversations
  drop constraint if exists store_conversations_owner_id_owner_type_customer_id_key;

create unique index if not exists store_conversations_brand_customer_key
  on public.store_conversations(
    owner_id,
    owner_type,
    customer_id,
    coalesce(storefront_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

alter table if exists public.orders
  add column if not exists storefront_id uuid references public.storefronts(id) on delete set null;

create index if not exists orders_storefront_fulfillment_idx
  on public.orders(storefront_id, created_at desc);

-- Normalize reviews around the authenticated user ID. Older migrations mixed
-- profile IDs and auth user IDs, which could reject a legitimate buyer review.
alter table if exists public.product_reviews
  add column if not exists reviewer_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists title text,
  add column if not exists content text,
  add column if not exists verified_purchase boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.product_reviews alter column reviewer_id drop not null;

do $do$
begin
  if to_regclass('public.product_reviews') is null then
    return;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_reviews' and column_name = 'reviewer_id'
  ) then
    update public.product_reviews r
    set reviewer_user_id = p.user_id
    from public.profiles p
    where r.reviewer_user_id is null and p.id = r.reviewer_id;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'product_reviews' and column_name = 'buyer_id'
  ) then
    update public.product_reviews r
    set reviewer_user_id = p.user_id
    from public.profiles p
    where r.reviewer_user_id is null and p.id = r.buyer_id;
  end if;
end;
$do$;

create unique index if not exists product_reviews_verified_buyer_key
  on public.product_reviews(product_id, reviewer_user_id)
  where reviewer_user_id is not null;

alter table if exists public.product_reviews enable row level security;

drop policy if exists "Anyone can view product reviews" on public.product_reviews;
create policy "Anyone can view product reviews"
  on public.product_reviews for select
  to anon, authenticated
  using (true);

-- Retire the restored profile-ID policies. Leaving them in place would OR
-- their checks with the verified-buyer policy below and allow unverified
-- reviews to bypass the purchase requirement.
drop policy if exists "Users can create reviews for products" on public.product_reviews;
drop policy if exists "Users can update their own reviews" on public.product_reviews;
drop policy if exists "Users can delete their own reviews" on public.product_reviews;

drop policy if exists "Verified buyers create product reviews" on public.product_reviews;
create policy "Verified buyers create product reviews"
  on public.product_reviews for insert
  to authenticated
  with check (
    reviewer_user_id = (select auth.uid())
    and verified_purchase = true
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      left join public.profiles buyer_profile on buyer_profile.id = o.buyer_id
      where oi.product_id = product_reviews.product_id
        and (
          o.buyer_id = (select auth.uid())
          or buyer_profile.user_id = (select auth.uid())
        )
        and lower(coalesce(o.status, '')) in ('paid','completed','succeeded','fulfilled','shipped','delivered')
    )
  );

drop policy if exists "Buyers update own product reviews" on public.product_reviews;
create policy "Buyers update own product reviews"
  on public.product_reviews for update
  to authenticated
  using (reviewer_user_id = (select auth.uid()))
  with check (reviewer_user_id = (select auth.uid()));

grant select on public.product_reviews to anon;
grant select, insert, update on public.product_reviews to authenticated;

-- Convert the existing MareBelle seller store into the first brand storefront,
-- then create RedTail as the second brand under the same account.
do $do$
declare
  v_profile_id uuid;
  v_marebelle_id uuid;
begin
  select p.id into v_profile_id
  from public.profiles p
  where lower(coalesce(p.email, '')) = 'jasonlovingsr@gmail.com'
     or lower(coalesce(p.full_name, '')) = 'jasonlovingsr'
  order by case when lower(coalesce(p.email, '')) = 'jasonlovingsr@gmail.com' then 0 else 1 end
  limit 1;

  if v_profile_id is null then
    raise notice 'jasonlovingsr profile not found; storefront/admin seed skipped';
    return;
  end if;

  insert into public.storefronts (
    owner_id, type, name, slug, custom_domain, logo_url, description,
    banner_url, store_theme, product_page_template, layout_config,
    theme_settings, color_scheme, social_links, business_hours,
    shipping_policy, return_policy, custom_css, is_active
  )
  select
    v_profile_id,
    'seller'::public.storefront_type,
    coalesce(nullif(s.store_name, ''), 'MareBelle'),
    'marebelle',
    s.custom_domain,
    s.store_logo,
    coalesce(nullif(s.store_description, ''), 'Equestrian beauty, fragrance, and stable essentials chosen with care.'),
    s.store_banner,
    coalesce(nullif(s.store_theme, ''), 'elegant'),
    s.product_page_template,
    coalesce(s.layout_config, '{}'::jsonb),
    '{}'::jsonb,
    coalesce(s.color_scheme, '{"primary":"#0f172a","secondary":"#e2e8f0","accent":"#f59e0b","background":"#f8fafc","text":"#0f172a"}'::jsonb),
    coalesce(s.social_links, '{}'::jsonb),
    s.business_hours,
    s.shipping_policy,
    s.return_policy,
    s.custom_css,
    true
  from public.store_settings s
  where s.seller_id = v_profile_id
  limit 1
  on conflict (slug) do update set
    owner_id = excluded.owner_id,
    name = excluded.name,
    description = excluded.description,
    logo_url = coalesce(excluded.logo_url, public.storefronts.logo_url),
    banner_url = coalesce(excluded.banner_url, public.storefronts.banner_url),
    updated_at = now();

  -- If the legacy row is absent, MareBelle still gets a valid storefront shell.
  insert into public.storefronts (
    owner_id, type, name, slug, description, store_theme, layout_config,
    color_scheme, is_active
  ) values (
    v_profile_id, 'seller'::public.storefront_type, 'MareBelle', 'marebelle',
    'Equestrian beauty, fragrance, and stable essentials chosen with care.',
    'elegant',
    '{"header_style":"minimal","product_grid":"2-col","show_story":true}'::jsonb,
    '{"primary":"#0f172a","secondary":"#e2e8f0","accent":"#f59e0b","background":"#f8fafc","text":"#0f172a"}'::jsonb,
    true
  ) on conflict (slug) do nothing;

  select id into v_marebelle_id from public.storefronts where slug = 'marebelle' limit 1;

  -- Preserve the products already shown in MareBelle.
  if v_marebelle_id is not null then
    insert into public.storefront_products (storefront_id, product_id, position)
    select v_marebelle_id, p.id, row_number() over (order by p.created_at desc)::integer
    from public.products p
    where p.seller_id = v_profile_id
    on conflict (storefront_id, product_id) do nothing;
  end if;

  insert into public.storefronts (
    owner_id, type, name, slug, description, store_theme,
    layout_config, theme_settings, color_scheme, shipping_policy,
    return_policy, is_active
  ) values (
    v_profile_id,
    'seller'::public.storefront_type,
    'RedTail',
    'redtail',
    'Hard-working horse, ranch, and outdoor essentials selected for life beyond the pavement.',
    'classic',
    '{"header_style":"full-width","product_grid":"3-col","show_featured":true,"show_about":true,"show_policies":true,"storefront_sections":["hero","search","categories","featured","about","policies","contact"]}'::jsonb,
    '{"brand_personality":"western","corner_style":"subtle","image_treatment":"warm"}'::jsonb,
    '{"primary":"#3b1f16","secondary":"#d6c4aa","accent":"#b4482f","background":"#f6f1e8","text":"#281812"}'::jsonb,
    'Shipping choices and delivery estimates are shown at checkout.',
    'Returns and order issues are handled through the Beezio Resolution Center.',
    true
  )
  on conflict (slug) do update set
    owner_id = excluded.owner_id,
    name = excluded.name,
    description = excluded.description,
    store_theme = excluded.store_theme,
    layout_config = excluded.layout_config,
    theme_settings = excluded.theme_settings,
    color_scheme = excluded.color_scheme,
    shipping_policy = excluded.shipping_policy,
    return_policy = excluded.return_policy,
    is_active = true,
    updated_at = now();

  -- The account remains multi-role, but opens in the admin workspace and can
  -- fulfill orders from every owned storefront.
  insert into public.user_roles (user_id, role, is_active)
  select p.user_id, r.role, true
  from public.profiles p
  cross join (values ('admin'), ('seller'), ('affiliate'), ('influencer')) as r(role)
  where p.id = v_profile_id
  on conflict (user_id, role) do update set is_active = true, updated_at = now();

  update public.profiles
  set role = 'admin', primary_role = 'admin', updated_at = now()
  where id = v_profile_id;
end;
$do$;
