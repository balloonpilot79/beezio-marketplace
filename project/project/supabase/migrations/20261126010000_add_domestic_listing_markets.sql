alter table public.products
  add column domestic_market_country text,
  add constraint products_domestic_market_country_check check (
    domestic_market_country is null
    or (
      domestic_market_country in ('US', 'GB', 'CA', 'AU')
      and is_digital is not true
    )
  ),
  add constraint products_domestic_market_availability_check check (
    domestic_market_country is null
    or domestic_market_country = 'US'
    or (status is not distinct from 'draft' and is_active is false and is_promotable is false)
  );

comment on column public.products.domestic_market_country is
  'Country where a physical listing is stocked and fulfilled. A null value uses existing fulfillment settings.';

-- A broad public catalog policy must not expose unpublished market drafts.
create policy products_domestic_drafts_visibility
  on public.products as restrictive for select to anon, authenticated
  using (
    domestic_market_country is null or domestic_market_country = 'US'
    or seller_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = products.seller_id and p.user_id = auth.uid()
    )
  );

create policy products_domestic_drafts_owner_select
  on public.products for select to authenticated
  using (
    domestic_market_country in ('GB', 'CA', 'AU')
    and (
      seller_id = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = products.seller_id and p.user_id = auth.uid()
      )
    )
  );
