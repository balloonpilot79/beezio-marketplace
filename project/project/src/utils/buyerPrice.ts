// Beezio: CJ Variants + Shipping extension (do not remove)
// Central helper to ensure storefronts display buyer-facing prices (not seller payout/ask).

import { calculateSalePriceFromSellerAsk, resolveAffiliateCommission } from './pricing';

type CommissionType = 'percentage' | 'flat_rate' | string | null | undefined;

type PriceLikeProduct = {
  price?: number | null;
  calculated_customer_price?: number | null;
  seller_ask?: number | null;
  seller_amount?: number | null;
  seller_ask_price?: number | null;
  commission_rate?: number | null;
  affiliate_commission_rate?: number | null;
  commission_type?: CommissionType;
  flat_commission_amount?: number | null;
  affiliate_commission_type?: 'percent' | 'flat' | null;
  affiliate_commission_value?: number | null;
};

const toFiniteNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Returns the buyer-facing price for display + cart/checkout.
 *
 * Rules:
 * - If a baked customer-facing price exists, trust it.
 * - If product.price looks like it equals the seller ask (legacy data), compute instead.
 * - Only recompute from seller ask when the final buyer-facing price is missing.
 */
export function getBuyerFacingProductPrice(product: PriceLikeProduct): number {
  const calculatedCustomerPrice = toFiniteNumber(product?.calculated_customer_price);
  if (calculatedCustomerPrice > 0) return calculatedCustomerPrice;

  const directPrice = toFiniteNumber(product?.price);
  const sellerAsk = toFiniteNumber(product?.seller_ask) || toFiniteNumber(product?.seller_amount) || toFiniteNumber(product?.seller_ask_price);

  const affiliatePricing = resolveAffiliateCommission(product);
  const isFlat = affiliatePricing.type === 'flat';
  const affiliateRate = toFiniteNumber(affiliatePricing.value);

  if (sellerAsk > 0) {
    const computedBuyerPrice = calculateSalePriceFromSellerAsk(sellerAsk, affiliateRate, isFlat ? 'flat' : 'percent');

    // If direct price is missing or looks like a seller payout value, use computed.
    if (directPrice <= 0) return computedBuyerPrice;
    if (Math.abs(directPrice - sellerAsk) <= 0.01) return computedBuyerPrice;

    return directPrice;
  }

  return directPrice;
}
