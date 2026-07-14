-- Restore the signed-in dashboard paths that use canonical profile ids.
-- Service-role payment processing continues to bypass RLS as before.

alter table public.payout_items enable row level security;

drop policy if exists "users can read own payout items" on public.payout_items;
create policy "users can read own payout items"
  on public.payout_items
  for select
  to authenticated
  using (
    payee_user_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = payout_items.payee_user_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists products_owner_profile_insert on public.products;
create policy products_owner_profile_insert
  on public.products
  for insert
  to authenticated
  with check (
    seller_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = products.seller_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists products_owner_profile_update on public.products;
create policy products_owner_profile_update
  on public.products
  for update
  to authenticated
  using (
    seller_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = products.seller_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    seller_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = products.seller_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists affiliate_links_owner_profile_all on public.affiliate_links;
create policy affiliate_links_owner_profile_all
  on public.affiliate_links
  for all
  to authenticated
  using (
    affiliate_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = affiliate_links.affiliate_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    affiliate_id = auth.uid()
    or exists (
      select 1
      from public.profiles p
      where p.id = affiliate_links.affiliate_id
        and p.user_id = auth.uid()
    )
  );
