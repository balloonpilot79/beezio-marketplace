-- Apply after deploying the flat $2 policy. This changes future catalog sales only.
-- Preserve saved orders, influencer allocations, and seller shipping policies.
begin;
update public.product_variants v
set seller_markup_amount = 3, seller_payout_amount = 13.10, affiliate_payout_amount = 5,
    price = case when p.shipping_reserve_amount = 5.99 then 29.89 else 31.97 end,
    calculated_customer_price = case when p.shipping_reserve_amount = 5.99 then 29.89 else 31.97 end,
    retail_price_cents = case when p.shipping_reserve_amount = 5.99 then 2989 else 3197 end
from public.products p
where v.product_id = p.id and p.seller_id = '1deb1c67-4058-4f34-8c7c-1f0a9ecf47db'
  and p.is_active = true and p.status = 'active' and p.title ilike '%t-shirt%'
  and p.supplier_cost_amount = 10.10 and p.seller_ask = 15.10
  and p.calculated_customer_price = 33.01 and v.calculated_customer_price = 33.01
  and v.seller_payout_amount = 15.10 and v.supplier_cost_amount = 10.10
  and v.affiliate_payout_amount = p.affiliate_payout_amount
  and v.shipping_reserve_amount = p.shipping_reserve_amount
  and p.shipping_reserve_amount in (5.99, 7.99);

update public.products
set seller_markup_amount = 3, seller_ask = 13.10, seller_amount = 13.10, seller_ask_price = 13.10,
    markup_type = 'flat', markup_value = 300,
    affiliate_payout_amount = 5, flat_commission_amount = 5,
    affiliate_commission_type = 'flat', affiliate_commission_value = 5,
    commission_type = 'flat_rate', commission_rate = 5, affiliate_commission_rate = 5,
    platform_fee = 2,
    price = case when shipping_reserve_amount = 5.99 then 29.89 else 31.97 end,
    calculated_customer_price = case when shipping_reserve_amount = 5.99 then 29.89 else 31.97 end,
    retail_price_cents = case when shipping_reserve_amount = 5.99 then 2989 else 3197 end,
    paypal_processing_allowance = case when shipping_reserve_amount = 5.99 then 1.80 else 1.88 end
where seller_id = '1deb1c67-4058-4f34-8c7c-1f0a9ecf47db'
  and is_active = true and status = 'active' and title ilike '%t-shirt%'
  and supplier_cost_amount = 10.10 and seller_ask = 15.10
  and calculated_customer_price = 33.01 and shipping_reserve_amount in (5.99, 7.99);

-- Restore the blanket's platform allocation while preserving its seller inputs.
update public.product_variants v
set price = 39.36, calculated_customer_price = 39.36, retail_price_cents = 3936
from public.products p
where v.product_id = p.id and p.id = '95f4150d-906a-4559-85eb-4a8d0de0ab7d'
  and p.is_active = true and p.status = 'active' and p.calculated_customer_price = 38.31
  and v.calculated_customer_price = 38.31 and v.seller_payout_amount = 19.49
  and v.affiliate_payout_amount = 8 and v.shipping_reserve_amount = 5.69;
update public.products
set price = 39.36, calculated_customer_price = 39.36, retail_price_cents = 3936,
    platform_fee = 2, paypal_processing_allowance = 2.18
where id = '95f4150d-906a-4559-85eb-4a8d0de0ab7d' and is_active = true and status = 'active'
  and calculated_customer_price = 38.31 and seller_ask = 19.49
  and affiliate_payout_amount = 8 and shipping_reserve_amount = 5.69;
commit;
