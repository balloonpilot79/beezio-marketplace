-- Fixed-tier Beezio pricing contract.
-- Product prices are pre-tax and include seller payout, fixed affiliate payout,
-- supplier shipping reserve, two influencer slots, fixed Beezio fee, and the
-- configured PayPal allowance.

alter table public.products
  add column if not exists supplier_cost_amount numeric(12,2) not null default 0,
  add column if not exists seller_markup_amount numeric(12,2) not null default 0,
  add column if not exists affiliate_payout_amount numeric(12,2) not null default 0,
  add column if not exists shipping_reserve_amount numeric(12,2) not null default 0,
  add column if not exists influencer_allocation_amount numeric(12,2) not null default 0,
  add column if not exists paypal_processing_allowance numeric(12,2) not null default 0;

alter table public.order_items
  add column if not exists supplier_cost_amount numeric(12,2) not null default 0,
  add column if not exists seller_markup_amount numeric(12,2) not null default 0,
  add column if not exists affiliate_payout_amount numeric(12,2) not null default 0,
  add column if not exists shipping_reserve_amount numeric(12,2) not null default 0,
  add column if not exists influencer_allocation_amount numeric(12,2) not null default 0,
  add column if not exists platform_fee_amount numeric(12,2) not null default 0,
  add column if not exists paypal_processing_allowance numeric(12,2) not null default 0;

create or replace function public.beezio_fixed_platform_fee_sql(p_final_price numeric)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when coalesce(p_final_price, 0) <= 0 then 0::numeric
    when p_final_price < 25 then 1::numeric
    else (2 * (floor(p_final_price / 100) + 1))::numeric
  end;
$$;

create or replace function public.beezio_influencer_allocation_sql(p_final_price numeric)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when coalesce(p_final_price, 0) < 20 then 1::numeric
    else 2::numeric
  end;
$$;

create or replace function public.beezio_fixed_tier_price_sql(
  p_seller_payout numeric,
  p_affiliate_payout numeric,
  p_shipping_reserve numeric,
  p_paypal_percent numeric default 0.0399,
  p_paypal_fixed numeric default 0.60
)
returns numeric
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  v_base numeric := greatest(coalesce(p_seller_payout, 0), 0)
    + greatest(coalesce(p_affiliate_payout, 0), 0)
    + greatest(coalesce(p_shipping_reserve, 0), 0);
  v_price numeric := v_base;
  v_next numeric;
  v_index integer;
begin
  for v_index in 1..100 loop
    v_next := ceil((
      v_base
      + public.beezio_influencer_allocation_sql(v_price)
      + public.beezio_fixed_platform_fee_sql(v_price)
      + ceil((v_price * greatest(coalesce(p_paypal_percent, 0), 0)
        + greatest(coalesce(p_paypal_fixed, 0), 0)) * 100) / 100
    ) * 100) / 100;
    exit when v_next = v_price;
    v_price := v_next;
  end loop;
  return v_price;
end;
$$;

revoke all on function public.beezio_fixed_platform_fee_sql(numeric) from public;
revoke all on function public.beezio_influencer_allocation_sql(numeric) from public;
revoke all on function public.beezio_fixed_tier_price_sql(numeric,numeric,numeric,numeric,numeric) from public;
grant execute on function public.beezio_fixed_platform_fee_sql(numeric) to anon, authenticated, service_role;
grant execute on function public.beezio_influencer_allocation_sql(numeric) to anon, authenticated, service_role;
grant execute on function public.beezio_fixed_tier_price_sql(numeric,numeric,numeric,numeric,numeric) to anon, authenticated, service_role;

with source as (
  select
    p.id,
    greatest(
      coalesce(
        nullif(p.shipping_reserve_amount, 0),
        case
          when coalesce(p.shipping_options->0->>'seller_shipping_cost', '') ~ '^[0-9]+([.][0-9]+)?$'
            then nullif((p.shipping_options->0->>'seller_shipping_cost')::numeric, 0)
          else null
        end,
        nullif(p.shipping_price, 0),
        nullif(p.shipping_cost, 0),
        0
      ),
      0
    )::numeric(12,2) as shipping_reserve,
    greatest(coalesce(p.seller_amount, p.seller_ask, p.seller_ask_price, 0), 0)::numeric(12,2) as stored_seller_amount,
    lower(coalesce(p.shipping_options->0->>'included_in_price', 'false')) = 'true'
      as legacy_shipping_in_seller_amount,
    greatest(
      coalesce(
        nullif(p.supplier_cost_amount, 0),
        nullif(p.base_cost_cents, 0)::numeric / 100,
        case
          when coalesce(p.supplier_info->>'wholesale_price', '') ~ '^[0-9]+([.][0-9]+)?$'
            then (p.supplier_info->>'wholesale_price')::numeric
          else null
        end,
        0
      ),
      0
    )::numeric(12,2) as stored_supplier_cost,
    case
      when coalesce(p.affiliate_enabled, true) = false then 0
      when coalesce(p.affiliate_payout_amount, 0) > 0 then p.affiliate_payout_amount
      when coalesce(p.flat_commission_amount, 0) > 0 then p.flat_commission_amount
      when lower(coalesce(p.affiliate_commission_type, '')) = 'flat' then greatest(coalesce(p.affiliate_commission_value, 0), 0)
      when lower(coalesce(p.commission_type, '')) in ('flat_rate', 'fixed') then greatest(coalesce(p.affiliate_commission_value, p.commission_rate, 0), 0)
      else greatest(coalesce(p.seller_amount, p.seller_ask, p.seller_ask_price, 0), 0)
        * greatest(coalesce(p.affiliate_commission_value, p.affiliate_commission_rate, p.commission_rate, 0), 0) / 100
    end::numeric(12,2) as affiliate_payout
  from public.products p
),
normalized as (
  select
    source.*,
    greatest(
      stored_seller_amount -
        case when legacy_shipping_in_seller_amount then shipping_reserve else 0 end,
      0
    )::numeric(12,2) as seller_payout
  from source
),
priced as (
  select
    normalized.*,
    least(stored_supplier_cost, seller_payout)::numeric(12,2) as supplier_cost,
    public.beezio_fixed_tier_price_sql(
      seller_payout,
      affiliate_payout,
      shipping_reserve
    )::numeric(12,2) as final_price
  from normalized
),
finalized as (
  select
    priced.*,
    greatest(seller_payout - supplier_cost, 0)::numeric(12,2) as seller_markup,
    public.beezio_fixed_platform_fee_sql(final_price)::numeric(12,2) as fixed_platform_fee,
    public.beezio_influencer_allocation_sql(final_price)::numeric(12,2) as influencer_allocation,
    (ceil((final_price * 0.0399 + 0.60) * 100) / 100)::numeric(12,2) as paypal_allowance
  from priced
)
update public.products p
set
  price = finalized.final_price,
  calculated_customer_price = finalized.final_price,
  retail_price_cents = round(finalized.final_price * 100)::integer,
  seller_amount = finalized.seller_payout,
  seller_ask = finalized.seller_payout,
  seller_ask_price = finalized.seller_payout,
  supplier_cost_amount = finalized.supplier_cost,
  seller_markup_amount = finalized.seller_markup,
  affiliate_payout_amount = finalized.affiliate_payout,
  shipping_reserve_amount = finalized.shipping_reserve,
  influencer_allocation_amount = finalized.influencer_allocation,
  platform_fee = finalized.fixed_platform_fee,
  paypal_processing_allowance = finalized.paypal_allowance,
  stripe_fee = finalized.paypal_allowance,
  commission_rate = 0,
  affiliate_commission_rate = 0,
  partner_commission_percent = 0,
  commission_type = 'flat_rate',
  affiliate_commission_type = 'flat',
  flat_commission_amount = finalized.affiliate_payout,
  affiliate_commission_value = finalized.affiliate_payout,
  base_cost_cents = round(finalized.supplier_cost * 100)::integer,
  markup_type = 'flat',
  markup_value = round(finalized.seller_markup * 100)::integer,
  shipping_price = finalized.shipping_reserve,
  shipping_cost = finalized.shipping_reserve,
  shipping_options = case
    when coalesce(p.is_digital, false) then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'name', 'Free Shipping',
      'cost', 0,
      'estimated_days', coalesce(p.shipping_options->0->>'estimated_days', '3-5 business days'),
      'included_in_price', true,
      'seller_shipping_cost', finalized.shipping_reserve
    ))
  end,
  updated_at = now()
from finalized
where p.id = finalized.id;

comment on column public.products.supplier_cost_amount is 'Supplier/product cost included in seller payout.';
comment on column public.products.seller_markup_amount is 'Seller-selected profit included in seller payout.';
comment on column public.products.affiliate_payout_amount is 'Fixed dollars earned by the attributed affiliate per completed unit sale.';
comment on column public.products.shipping_reserve_amount is 'Supplier shipping expense baked into the advertised price; checkout shipping is zero.';
comment on column public.products.influencer_allocation_amount is 'Two-slot influencer allocation based on final advertised price.';
comment on column public.products.paypal_processing_allowance is 'Estimated PayPal processing amount baked into advertised price.';
