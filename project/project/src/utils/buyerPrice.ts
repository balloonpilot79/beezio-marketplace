// Beezio: CJ Variants + Shipping extension (do not remove)
// Central helper to ensure storefronts display buyer-facing prices (not seller payout/ask).

import { calculateSalePriceFromSellerAsk, DEFAULT_AFFILIATE_RATE } from './pricing';

type CommissionType = 'percentage' | 'flat_rate' | string | null | undefined;

type PriceLikeProduct = {
  price?: number | null;
  seller_ask?: number | null;
  seller_amount?: number | null;
  seller_ask_price?: number | null;
  commission_rate?: number | null;
  affiliate_commission_rate?: number | null;
  commission_type?: CommissionType;
  flat_commission_amount?: number | null;
};

const toFiniteNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Returns the buyer-facing price for display + cart/checkout.
 *
 * Rules:
 * - If we have a seller ask, we can compute the buyer price using Beezio pricing.
 * - If product.price looks like it equals the seller ask (legacy data), compute instead.
 * - Otherwise, assume product.price is already buyer-facing and return it.
 */
export function getBuyerFacingProductPrice(product: PriceLikeProduct): number {
  const directPrice = toFiniteNumber(product?.price);
  const sellerAsk = toFiniteNumber(product?.seller_ask) || toFiniteNumber(product?.seller_amount) || toFiniteNumber(product?.seller_ask_price);

  const commissionType = (product?.commission_type || 'percentage') as CommissionType;
  const isFlat = commissionType === 'flat_rate';

  const affiliateRate = isFlat
    ? toFiniteNumber(product?.flat_commission_amount)
    : toFiniteNumber(product?.commission_rate) || toFiniteNumber(product?.affiliate_commission_rate) || DEFAULT_AFFILIATE_RATE;

  if (sellerAsk > 0) {
    const computedBuyerPrice = calculateSalePriceFromSellerAsk(sellerAsk, affiliateRate, isFlat ? 'flat' : 'percent');

    // If direct price is missing or looks like a seller payout value, use computed.
    if (directPrice <= 0) return computedBuyerPrice;
    if (directPrice <= sellerAsk + 0.01) return computedBuyerPrice;
    if (directPrice + 0.01 < computedBuyerPrice) return computedBuyerPrice;

    return directPrice;
  }

  return directPrice;
}

