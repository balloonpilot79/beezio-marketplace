/**
 * Beezio's fixed platform fee is based on the final advertised product price
 * before sales tax. Percentage-based platform pricing is intentionally not
 * supported by the current commerce contract.
 */
export const DEFAULT_BEEZIO_PLATFORM_RATE = 0;
export const DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE = 1;
export const DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD = 25;
export const DEFAULT_BEEZIO_MIN_NET_PROFIT = 0;
export const DEFAULT_BEEZIO_PLATFORM_FEE_MIN = 1;
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
  if (price < 25) return 1;
  return toMoney(2 * (Math.floor(price / 100) + 1));
}

/**
 * Backward-compatible name used across the app. The first argument is now the
 * final advertised price, not the seller ask. Legacy options are accepted only
 * so older call sites fail safely while they are migrated.
 */
export function computeBeezioPlatformFee(
  finalAdvertisedPrice: number,
  _options?: PlatformFeeOptions,
): number {
  return computeFixedBeezioPlatformFee(finalAdvertisedPrice);
}

/**
 * Backward-compatible pool helper. Fixed-tier pricing has no percentage pool;
 * callers receive the fixed fee for the supplied final/listing price.
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
