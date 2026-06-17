create or replace function public.beezio_baked_price_sql(
  p_seller_ask numeric,
  p_commission_type text,
  p_commission_value numeric
)
returns numeric
language sql
immutable
as $$
  with inputs as (
    select
      greatest(coalesce(p_seller_ask, 0), 0)::numeric as seller_ask,
      lower(coalesce(p_commission_type, 'percent')) as commission_type,
      greatest(coalesce(p_commission_value, 0), 0)::numeric as commission_value
  ),
  computed as (
    select
      seller_ask,
      case
        when commission_type in ('flat', 'flat_rate', 'fixed') then commission_value
        else seller_ask * (commission_value / 100.0)
      end as affiliate_amount,
      public.beezio_platform_fee_sql(seller_ask) as platform_amount,
      case
        when seller_ask < 20 then 1.00
        else 2.00
      end as influencer_reserve
    from inputs
  )
  select ceil((((seller_ask + affiliate_amount + platform_amount + influencer_reserve + 0.60) / 0.97) * 100)) / 100.0
  from computed;
$$;

update public.products p
set
  price = public.beezio_baked_price_sql(
    coalesce(p.seller_ask, p.seller_amount, p.seller_ask_price, 0),
    coalesce(nullif(p.affiliate_commission_type, ''), p.commission_type::text, 'percent'),
    coalesce(
      nullif(p.affiliate_commission_value, 0),
      nullif(p.affiliate_commission_rate, 0),
      nullif(p.flat_commission_amount, 0),
      p.commission_rate,
      0
    )
  ),
  calculated_customer_price = public.beezio_baked_price_sql(
    coalesce(p.seller_ask, p.seller_amount, p.seller_ask_price, 0),
    coalesce(nullif(p.affiliate_commission_type, ''), p.commission_type::text, 'percent'),
    coalesce(
      nullif(p.affiliate_commission_value, 0),
      nullif(p.affiliate_commission_rate, 0),
      nullif(p.flat_commission_amount, 0),
      p.commission_rate,
      0
    )
  )
where coalesce(p.seller_ask, p.seller_amount, p.seller_ask_price, 0) > 0;

update public.product_variants pv
set
  price = public.beezio_baked_price_sql(
    case
      when coalesce(pv.cost_cents, 0) > 0 then
        (
          pv.cost_cents +
          case
            when coalesce(p.markup_type, 'flat') = 'percent'
              then greatest(round(pv.cost_cents * (greatest(coalesce(p.markup_value, 0), 0) / 100.0)), 300)
            else greatest(greatest(coalesce(p.markup_value, 0), 0), 300)
          end
        ) / 100.0
      else greatest(coalesce(pv.price, 0), 0)
    end,
    coalesce(nullif(p.affiliate_commission_type, ''), p.commission_type::text, 'percent'),
    coalesce(
      nullif(p.affiliate_commission_value, 0),
      nullif(p.affiliate_commission_rate, 0),
      nullif(p.flat_commission_amount, 0),
      p.commission_rate,
      0
    )
  ),
  retail_price_cents = round(
    public.beezio_baked_price_sql(
      case
        when coalesce(pv.cost_cents, 0) > 0 then
          (
            pv.cost_cents +
            case
              when coalesce(p.markup_type, 'flat') = 'percent'
                then greatest(round(pv.cost_cents * (greatest(coalesce(p.markup_value, 0), 0) / 100.0)), 300)
              else greatest(greatest(coalesce(p.markup_value, 0), 0), 300)
            end
          ) / 100.0
        else greatest(coalesce(pv.price, 0), 0)
      end,
      coalesce(nullif(p.affiliate_commission_type, ''), p.commission_type::text, 'percent'),
      coalesce(
        nullif(p.affiliate_commission_value, 0),
        nullif(p.affiliate_commission_rate, 0),
        nullif(p.flat_commission_amount, 0),
        p.commission_rate,
        0
      )
    ) * 100
  )::int
from public.products p
where p.id = pv.product_id;
