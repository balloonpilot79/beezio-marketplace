-- Apply only after deploying the shared affordability fee policy.
-- Reprice the audited launch catalog without changing seller-controlled inputs.
-- Existing orders and payout snapshots are never updated.
begin;

update public.product_variants v
set price = case when p.title ilike '%t-shirt%' then 33.01 else 38.31 end,
    calculated_customer_price = case when p.title ilike '%t-shirt%' then 33.01 else 38.31 end,
    retail_price_cents = case when p.title ilike '%t-shirt%' then 3301 else 3831 end
from public.products p
where v.product_id = p.id and p.is_active = true and p.status = 'active'
  and ((p.title ilike '%t-shirt%' and p.seller_ask = 15.10
        and ((p.affiliate_payout_amount = 7 and p.shipping_reserve_amount = 5.99)
          or (p.affiliate_payout_amount = 5 and p.shipping_reserve_amount = 7.99))
        and p.calculated_customer_price = 34.06 and v.calculated_customer_price = 34.06
        and v.seller_payout_amount = 15.10 and v.affiliate_payout_amount = p.affiliate_payout_amount
        and v.shipping_reserve_amount = p.shipping_reserve_amount)
    or (p.id = '95f4150d-906a-4559-85eb-4a8d0de0ab7d' and p.seller_ask = 19.49
        and p.affiliate_payout_amount = 8 and p.shipping_reserve_amount = 5.69
        and p.calculated_customer_price = 39.36 and v.calculated_customer_price = 39.36
        and v.seller_payout_amount = 19.49 and v.affiliate_payout_amount = 8
        and v.shipping_reserve_amount = 5.69));

update public.products
set price = 33.01, calculated_customer_price = 33.01, retail_price_cents = 3301,
    platform_fee = 1, paypal_processing_allowance = 1.92
where is_active = true and status = 'active' and title ilike '%t-shirt%'
  and seller_ask = 15.10 and calculated_customer_price = 34.06
  and ((affiliate_payout_amount = 7 and shipping_reserve_amount = 5.99)
    or (affiliate_payout_amount = 5 and shipping_reserve_amount = 7.99));

update public.products
set price = 38.31, calculated_customer_price = 38.31, retail_price_cents = 3831,
    platform_fee = 1, paypal_processing_allowance = 2.13
where id = '95f4150d-906a-4559-85eb-4a8d0de0ab7d' and is_active = true and status = 'active'
  and seller_ask = 19.49 and affiliate_payout_amount = 8 and shipping_reserve_amount = 5.69
  and calculated_customer_price = 39.36;

commit;
