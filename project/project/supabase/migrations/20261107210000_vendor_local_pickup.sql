alter table public.products
  add column pickup_mode text not null default 'shipping'
    check (pickup_mode in ('shipping', 'pickup', 'both')),
  add column pickup_state text,
  add column pickup_zip text,
  add constraint products_pickup_location_required check (
    pickup_mode = 'shipping' or (
      pickup_state is not null and pickup_state ~ '^[A-Z]{2}$' and
      pickup_zip is not null and pickup_zip ~ '^[0-9]{5}$'
    )
  );

alter table public.orders
  add column fulfillment_method text not null default 'shipping'
    check (fulfillment_method in ('shipping', 'pickup')),
  add column pickup_location jsonb,
  add column picked_up_at timestamptz;

create function public.confirm_vendor_pickup(p_order_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.orders o set picked_up_at = coalesce(o.picked_up_at, clock_timestamp())
  where o.id = p_order_id and o.fulfillment_method = 'pickup'
    and o.payment_status::text = 'paid'
    and (o.seller_id = auth.uid() or exists (
      select 1 from public.profiles pr where pr.id = o.seller_id and pr.user_id = auth.uid()
    ));
  return found;
end;
$$;

revoke execute on function public.confirm_vendor_pickup(uuid) from public, anon;
grant execute on function public.confirm_vendor_pickup(uuid) to authenticated;
