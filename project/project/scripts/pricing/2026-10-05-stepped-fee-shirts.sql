-- Future catalog sales only. Run after deploying seller-ask fee tiers.
-- User approved $29.99 delivered before tax for all 24 shirts, including
-- lower seller margin on the eight shirts with $7.99 shipping.
begin;
create temporary table shirt_reprice on commit drop as
select id, shipping_reserve_amount,
       case when shipping_reserve_amount=5.99 then 14.20 else 12.20 end as new_ask,
       case when shipping_reserve_amount=5.99 then 4.10 else 2.10 end as new_markup
from public.products
where seller_id='1deb1c67-4058-4f34-8c7c-1f0a9ecf47db'
  and is_active=true and status='active' and title ilike '%t-shirt%'
  and supplier_cost_amount=10.10 and seller_ask=13.10
  and affiliate_payout_amount=5 and platform_fee=2
  and ((shipping_reserve_amount=5.99 and calculated_customer_price=29.89)
    or (shipping_reserve_amount=7.99 and calculated_customer_price=31.97));
do $$ begin
  if (select count(*) from shirt_reprice) <> 24 then
    raise exception 'Expected exactly 24 unchanged shirts; aborting';
  end if;
  if (select count(*) from public.product_variants v join shirt_reprice p on p.id=v.product_id
      where v.supplier_cost_amount=10.10 and v.seller_payout_amount=13.10
      and v.affiliate_payout_amount=5 and v.shipping_reserve_amount=p.shipping_reserve_amount) <> 96 then
    raise exception 'Expected exactly 96 matching shirt variants; aborting';
  end if;
end $$;
update public.product_variants v
set seller_payout_amount=p.new_ask, seller_markup_amount=p.new_markup,
    price=29.99, calculated_customer_price=29.99, retail_price_cents=2999
from shirt_reprice p where v.product_id=p.id;
update public.products p
set seller_ask=r.new_ask, seller_amount=r.new_ask, seller_ask_price=r.new_ask,
    seller_markup_amount=r.new_markup, markup_type='flat', markup_value=round(r.new_markup*100),
    platform_fee=1, paypal_processing_allowance=1.80,
    price=29.99, calculated_customer_price=29.99, retail_price_cents=2999
from shirt_reprice r where p.id=r.id;
commit;
