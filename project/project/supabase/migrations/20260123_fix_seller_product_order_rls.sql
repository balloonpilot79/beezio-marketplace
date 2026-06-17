-- Allow seller_product_order owners to manage rows even on older profile schemas
-- (some deployments have profiles.id = auth.uid(), others have profiles.user_id = auth.uid())

alter table if exists public.seller_product_order enable row level security;

drop policy if exists "Sellers can manage their product order" on public.seller_product_order;
drop policy if exists "Public can view product order" on public.seller_product_order;

create policy "Sellers can manage their product order" on public.seller_product_order
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = seller_product_order.seller_id
        and (
          p.user_id = auth.uid()
          or p.id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = seller_product_order.seller_id
        and (
          p.user_id = auth.uid()
          or p.id = auth.uid()
        )
    )
  );

create policy "Public can view product order" on public.seller_product_order
  for select
  using (true);
