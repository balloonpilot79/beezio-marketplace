import { calculatePricing } from '../lib/pricing';

export interface PriceFitInput {
  targetDeliveredPrice: number;
  sellerPayout: number;
  affiliatePayout: number;
  shipping: number;
  productCost?: number;
}

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);

export function pricingReviewKey(sellerPayout: number, affiliatePayout: number, shipping: number, total: number, productCost: number) {
  return JSON.stringify([sellerPayout, affiliatePayout, shipping, total, productCost].map(cents));
}

export function pricingReviewIssue(sellerPayout: number, productCost: number, currentKey: string, reviewedKey: string) {
  if (cents(sellerPayout) < cents(productCost)) return 'Your seller payout is below the entered product cost. Review your costs and profit before publishing.';
  if (currentKey !== reviewedKey) return 'Confirm the buyer total including shipping and your affiliate payout before publishing.';
  return null;
}

/** Solve against the same pricing function used by the listing form. */
export function getPriceFit(input: PriceFitInput) {
  const targetCents = cents(input.targetDeliveredPrice);
  if (!Number.isSafeInteger(targetCents) || targetCents <= 0) return null;
  const affiliate = Math.max(0, Number(input.affiliatePayout) || 0);
  const shipping = Math.max(0, Number(input.shipping) || 0);
  const delivered = (sellerCents: number) => calculatePricing({
    sellerDesiredAmount: sellerCents / 100,
    affiliateRate: affiliate,
    shippingIncludedAmount: shipping,
  }).listingPrice;
  let low = 1;
  let high = targetCents;
  let best: number | null = null;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (cents(delivered(mid)) <= targetCents) {
      best = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  const currentDeliveredPrice = delivered(Math.max(0, cents(input.sellerPayout)));
  const maxSellerPayout = best === null ? null : best / 100;
  const knownCost = Math.max(0, Number(input.productCost) || 0);
  return {
    currentDeliveredPrice,
    overTarget: cents(currentDeliveredPrice) > targetCents,
    difference: (cents(currentDeliveredPrice) - targetCents) / 100,
    maxSellerPayout,
    fittedDeliveredPrice: best === null ? null : delivered(best),
    marginAtTarget: maxSellerPayout === null || knownCost <= 0
      ? null : (best! - cents(knownCost)) / 100,
    belowKnownCost: maxSellerPayout !== null && cents(maxSellerPayout) < cents(knownCost),
  };
}
