-- Pricing + shipping updates for seller-controlled payouts

-- New columns for shipping and affiliate configuration
alter table products
  add column if not exists shipping_price numeric default 0,
  add column if not exists affiliate_commission_type text default 'percent',
  add column if not exists affiliate_commission_value numeric default 0,
  add column if not exists calculated_customer_price numeric,
  add column if not exists seller_ask_price numeric;

-- Backfill shipping_price from legacy shipping_cost when missing
update products
  set shipping_price = coalesce(shipping_price, shipping_cost, 0)
  where shipping_price is null;

-- Ensure owners can read/write the new pricing fields
do $$
begin
  if not exists (
    select 1 from pg_policies
    where policyname = 'products_owner_update_shipping_price'
      and tablename = 'products'
  ) then
    create policy products_owner_update_shipping_price
      on products for update
      using (auth.uid() = seller_id)
      with check (auth.uid() = seller_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where policyname = 'products_owner_select_shipping_price'
      and tablename = 'products'
  ) then
    create policy products_owner_select_shipping_price
      on products for select
      using (auth.uid() = seller_id or is_active = true);
  end if;
end $$;
