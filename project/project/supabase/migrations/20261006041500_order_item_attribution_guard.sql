create or replace function public.backfill_order_item_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  if new.order_id is not null then
    select seller_id, coalesce(affiliate_id, partner_id) as affiliate_id, influencer_id
      into v_order
    from public.orders
    where id = new.order_id;

    if found then
      new.seller_id := coalesce(new.seller_id, v_order.seller_id);
      new.affiliate_id := coalesce(new.affiliate_id, v_order.affiliate_id);
      new.influencer_id := coalesce(new.influencer_id, v_order.influencer_id);
    end if;
  end if;

  if coalesce(new.unit_price, 0) = 0 then
    new.unit_price := new.price;
  end if;

  if coalesce(new.total_price, 0) = 0 then
    new.total_price := round((new.price * greatest(coalesce(new.quantity, 1), 1))::numeric, 2);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_backfill_order_item_attribution on public.order_items;

create trigger trg_backfill_order_item_attribution
before insert or update of order_id, seller_id, affiliate_id, influencer_id, price, unit_price, total_price, quantity
on public.order_items
for each row
execute function public.backfill_order_item_attribution();
