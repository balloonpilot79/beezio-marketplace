-- Beezio's customer-facing shipping policy is sitewide free shipping.
-- Legacy products that charged shipping separately are converted once:
--   seller product keep + supplier shipping reserve = seller payout
-- The listing price is then recalculated from the same affiliate/platform rules.

with legacy as (
  select
    p.id,
    greatest(
      0,
      coalesce(p.seller_amount, p.seller_ask, p.seller_ask_price, 0)::numeric
    ) as seller_base_amount,
    greatest(
      0,
      coalesce(
        nullif(p.shipping_price, 0),
        nullif(p.shipping_cost, 0),
        (
          select nullif(coalesce(option->>'cost', option->>'price', option->>'shipping_price'), '')::numeric
          from jsonb_array_elements(coalesce(p.shipping_options::jsonb, '[]'::jsonb)) option
          where coalesce(nullif(coalesce(option->>'cost', option->>'price', option->>'shipping_price'), '')::numeric, 0) > 0
          limit 1
        ),
        0
      )::numeric
    ) as supplier_shipping,
    case
      when lower(coalesce(p.affiliate_commission_type, '')) = 'flat'
        or lower(coalesce(p.commission_type, '')) in ('flat_rate', 'fixed')
      then greatest(
        0,
        coalesce(
          nullif(p.flat_commission_amount, 0),
          nullif(p.affiliate_commission_value, 0),
          nullif(p.affiliate_commission_rate, 0),
          nullif(p.commission_rate, 0),
          0
        )::numeric
      )
      else greatest(
        0,
        coalesce(
          nullif(p.affiliate_commission_value, 0),
          nullif(p.affiliate_commission_rate, 0),
          nullif(p.commission_rate, 0),
          0
        )::numeric
      )
    end as affiliate_value,
    case
      when lower(coalesce(p.affiliate_commission_type, '')) = 'flat'
        or lower(coalesce(p.commission_type, '')) in ('flat_rate', 'fixed')
      then 'flat'
      else 'percent'
    end as affiliate_type
  from public.products p
  where coalesce(p.is_digital, false) = false
    and coalesce(p.requires_shipping, true) = true
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p.shipping_options::jsonb, '[]'::jsonb)) option
      where coalesce((option->>'included_in_price')::boolean, false) = true
    )
),
priced as (
  select
    legacy.*,
    round((seller_base_amount + supplier_shipping)::numeric, 2) as seller_total,
    case
      when affiliate_type = 'flat' then round(affiliate_value, 2)
      else round((seller_base_amount + supplier_shipping) * (case when affiliate_value > 1 then affiliate_value / 100 else affiliate_value end), 2)
    end as affiliate_amount
  from legacy
),
fees as (
  select
    priced.*,
    case when seller_total < 25 then 1::numeric else 2::numeric end as influencer_reserve,
    case
      when seller_total < 25 then 2::numeric
      else round(
        greatest(
          seller_total * 0.15,
          (
            2
            + 0.0399 * (
              seller_total
              + affiliate_amount
              + case when seller_total < 25 then 1 else 2 end
            )
            + 0.60
          ) / (1 - 0.0399)
        ),
        2
      )
    end as platform_pool
  from priced
),
finalized as (
  select
    fees.*,
    case
      when seller_total < 25 then
        ceil(
          (
            (
              seller_total
              + affiliate_amount
              + platform_pool
              + influencer_reserve
              + 0.60
            ) / (1 - 0.0399)
          ) * 100
        ) / 100
      else
        ceil(
          (
            seller_total
            + affiliate_amount
            + platform_pool
            + influencer_reserve
          ) * 100
        ) / 100
    end as listing_price
  from fees
)
update public.products p
set
  seller_amount = finalized.seller_total,
  seller_ask = finalized.seller_total,
  seller_ask_price = finalized.seller_total,
  shipping_price = finalized.supplier_shipping,
  shipping_cost = finalized.supplier_shipping,
  shipping_options = jsonb_build_array(
    jsonb_build_object(
      'name', 'Free Shipping',
      'cost', 0,
      'estimated_days', '3-5 business days',
      'included_in_price', true,
      'seller_shipping_cost', finalized.supplier_shipping
    )
  ),
  price = finalized.listing_price,
  calculated_customer_price = finalized.listing_price,
  retail_price_cents = round(finalized.listing_price * 100)::integer,
  platform_fee = finalized.platform_pool,
  updated_at = now()
from finalized
where p.id = finalized.id;

update public.storefronts
set shipping_policy = 'Free shipping. Shipping costs are included in each physical product price.',
    updated_at = now()
where slug in ('marebelle', 'redtail', 'loving-nutrition');
