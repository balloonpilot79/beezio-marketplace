/**
 * Beezio fixed platform economics.
 *
 * The platform fee is Beezio's actual platform revenue. Influencer/recruiter
 * reserves are separate pass-through allocations and must never be counted as
 * Beezio profit when a slot is unused.
 */
export const DEFAULT_BEEZIO_PLATFORM_RATE = 0;
export const DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE = 2;
export const DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD = 25;
export const DEFAULT_BEEZIO_MIN_NET_PROFIT = 2;
export const DEFAULT_BEEZIO_PLATFORM_FEE_MIN = 2;
export const DEFAULT_BEEZIO_PLATFORM_FEE_CAP = Number.MAX_SAFE_INTEGER;
export const DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD = Number.MAX_SAFE_INTEGER;
export const DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE = 0;

type PlatformFeeOptions = {
  rate?: number;
  underThresholdFlatFee?: number;
  percentRateThreshold?: number;
  minimumNetProfit?: number;
  minimum?: number;
  cap?: number;
  largeOrderThreshold?: number;
  largeOrderFlatFee?: number;
};

const toMoney = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function computeFixedBeezioPlatformFee(finalAdvertisedPrice: number): number {
  const price = Number.isFinite(finalAdvertisedPrice)
    ? Math.max(0, Number(finalAdvertisedPrice))
    : 0;
  if (price <= 0) return 0;
  // Every non-zero advertised product below $25 must produce at least $2 of
  // actual Beezio platform revenue. Influencer reserves are not included.
  if (price < 25) return 2;
  return toMoney(2 * (Math.floor(price / 100) + 1));
}

/**
 * Backward-compatible name used across the app. The first argument is the
 * final advertised price, not the seller ask.
 */
export function computeBeezioPlatformFee(
  finalAdvertisedPrice: number,
  _options?: PlatformFeeOptions,
): number {
  return computeFixedBeezioPlatformFee(finalAdvertisedPrice);
}

/**
 * Fixed-tier platform revenue for the supplied final/listing price. Influencer
 * allocations and PayPal processing are intentionally excluded from this
 * value because they are not Beezio profit.
 */
export function computeBeezioPlatformPoolForPrice(params: {
  finalAdvertisedPrice?: number;
  listingPrice?: number;
  sellerAsk?: number;
  affiliateAmount?: number;
  influencerReserve?: number;
  paypalPercent?: number;
  paypalFixed?: number;
  rate?: number;
  underThresholdFlatFee?: number;
  percentRateThreshold?: number;
  minimumNetProfit?: number;
}): number {
  const price = Number(
    params.finalAdvertisedPrice ??
    params.listingPrice ??
    params.sellerAsk ??
    0
  );
  return computeFixedBeezioPlatformFee(price);
}
