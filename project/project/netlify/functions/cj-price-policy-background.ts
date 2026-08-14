import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { computeFixedTierPricing } from '../../shared/customerPrice';

const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const POLICIES = [
  { key: 'under_25', min: 0.01, max: 24.99, markup: 3, affiliate: 3.5 },
  { key: '25_49', min: 25, max: 49.99, markup: 7, affiliate: 6 },
  { key: '50_99', min: 50, max: 99.99, markup: 12, affiliate: 10 },
  { key: '100_249', min: 100, max: 249.99, markup: 25, affiliate: 20 },
  { key: '250_499', min: 250, max: 499.99, markup: 50, affiliate: 35 },
  { key: '500_999', min: 500, max: 999.99, markup: 80, affiliate: 60 },
  { key: '1000_plus', min: 1000, max: Number.POSITIVE_INFINITY, markup: 150, affiliate: 100 },
] as const;

type PricingPolicy = (typeof POLICIES)[number];

type VariantPricing = {
  variantId: string;
  supplierCost: number;
  shipping: number;
  policy: PricingPolicy;
  pricing: ReturnType<typeof computeFixedTierPricing>;
};

function pickPolicy(supplierCost: number, shipping: number): { policy: PricingPolicy; pricing: ReturnType<typeof computeFixedTierPricing> } {
  for (const policy of POLICIES) {
    const pricing = computeFixedTierPricing({
      supplierCost,
      sellerMarkup: policy.markup,
      affiliatePayout: policy.affiliate,
      shippingIncluded: shipping,
    });
    if (pricing.finalAdvertisedPrice >= policy.min && pricing.finalAdvertisedPrice <= policy.max) {
      return { policy, pricing };
    }
  }

  const policy = POLICIES[POLICIES.length - 1];
  return {
    policy,
    pricing: computeFixedTierPricing({
      supplierCost,
      sellerMarkup: policy.markup,
      affiliatePayout: policy.affiliate,
      shippingIncluded: shipping,
    }),
  };
}

export const handler: Handler = async (event) => {
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  if (!serviceRoleKey || suppliedToken !== serviceRoleKey) return { statusCode: 403, body: '' };

  const supabase = createSupabaseAdmin();
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id,title,cj_product_id,cj_pid')
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('cj_live_audit_status', 'passed')
    .eq('is_active', true)
    .eq('is_promotable', true)
    .limit(500);

  if (productError) throw productError;
  if (!products?.length) return { statusCode: 202, body: '' };

  for (const product of products as any[]) {
    const { data: variants, error: variantError } = await supabase
      .from('product_variants')
      .select('id,supplier_cost_amount,shipping_reserve_amount,is_active,is_orderable,order_reference_type,cj_vid,cj_variant_sku')
      .eq('product_id', product.id)
      .eq('source_platform', 'cj')
      .eq('is_active', true)
      .eq('is_orderable', true);
    if (variantError || !variants?.length) continue;

    const repriced: VariantPricing[] = [];
    let invalid = false;

    for (const variant of variants as any[]) {
      const supplierCost = money(variant?.supplier_cost_amount);
      const shipping = money(variant?.shipping_reserve_amount);
      const vid = text(variant?.cj_vid);
      const sku = text(variant?.cj_variant_sku);
      if (!(supplierCost > 0) || shipping < 0 || !vid || !sku || text(variant?.order_reference_type).toLowerCase() !== 'cj_vid') {
        invalid = true;
        break;
      }
      const { policy, pricing } = pickPolicy(supplierCost, shipping);
      repriced.push({ variantId: text(variant.id), supplierCost, shipping, policy, pricing });
    }

    if (invalid || repriced.length !== variants.length) continue;

    for (const row of repriced) {
      await supabase.from('product_variants').update({
        seller_markup_amount: money(row.policy.markup),
        seller_payout_amount: money(row.pricing.sellerPayout),
        affiliate_payout_amount: money(row.policy.affiliate),
        calculated_customer_price: money(row.pricing.finalAdvertisedPrice),
        price: money(row.pricing.finalAdvertisedPrice),
        retail_price_cents: Math.round(row.pricing.finalAdvertisedPrice * 100),
        updated_at: new Date().toISOString(),
      }).eq('id', row.variantId);
    }

    const parent = [...repriced].sort((a, b) => b.pricing.finalAdvertisedPrice - a.pricing.finalAdvertisedPrice)[0];
    const maxSupplierCost = Math.max(...repriced.map((row) => row.supplierCost));
    const maxShipping = Math.max(...repriced.map((row) => row.shipping));
    const maxAffiliate = Math.max(...repriced.map((row) => row.policy.affiliate));
    const maxMarkup = Math.max(...repriced.map((row) => row.policy.markup));
    const maxSellerPayout = Math.max(...repriced.map((row) => row.pricing.sellerPayout));

    await supabase.from('products').update({
      supplier_cost_amount: money(maxSupplierCost),
      seller_markup_amount: money(maxMarkup),
      markup_type: 'flat',
      markup_value: Math.round(maxMarkup * 100),
      seller_ask: money(maxSellerPayout),
      seller_amount: money(maxSellerPayout),
      seller_ask_price: money(maxSellerPayout),
      affiliate_enabled: true,
      commission_type: 'flat_rate',
      commission_rate: money(maxAffiliate),
      flat_commission_amount: money(maxAffiliate),
      affiliate_payout_amount: money(maxAffiliate),
      affiliate_floor_cents: Math.round(maxAffiliate * 100),
      affiliate_commission_type: 'flat',
      affiliate_commission_value: money(maxAffiliate),
      shipping_reserve_amount: money(maxShipping),
      shipping_estimate_cents: Math.round(maxShipping * 100),
      calculated_customer_price: money(parent.pricing.finalAdvertisedPrice),
      price: money(parent.pricing.finalAdvertisedPrice),
      retail_price_cents: Math.round(parent.pricing.finalAdvertisedPrice * 100),
      influencer_allocation_amount: money(parent.pricing.influencerAllocation),
      platform_fee: money(parent.pricing.platformFee),
      paypal_processing_allowance: money(parent.pricing.paypalProcessingAllowance),
      updated_at: new Date().toISOString(),
    }).eq('id', product.id);
  }

  return { statusCode: 202, body: '' };
};

export default handler;
