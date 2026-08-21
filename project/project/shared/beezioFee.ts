/**
 * Beezio fixed platform economics.
 *
 * The platform fee is Beezio revenue. Influencer/recruiter allocations are
 * baked into the advertised price. When a slot is unused, that reserved
 * amount remains with Beezio and is therefore Beezio profit.
 */
export const DEFAULT_BEEZIO_PLATFORM_RATE = 0;
export const DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE = 2;
export const DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD = 25;
export const DEFAULT_BEEZIO_MIN_NET_PROFIT = 2;
export const DEFAULT_BEEZIO_PLATFORM_FEE_MIN = 2;
export const DEFAULT_BEEZIO_PLATFORM_FEE_CAP = Number.MAX_SAFE_INTEGER;
export const DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD = Number.MAX_SAFE_INTEGER;
export const DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE = 0;

/** PayPal Payouts API fee currently published for USD domestic payouts. */
export const PAYPAL_PAYOUT_API_FEE_USD = 0.25;

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
  // Every non-zero advertised product below $25 must reserve at least $2 of
  // actual Beezio profit. Influencer reserves are additional price components;
  // unused reserves are retained by Beezio.
  if (price < 25) return 2;
  return toMoney(2 * (Math.floor(price / 100) + 1));
}

export function computeBeezioPlatformFee(
  finalAdvertisedPrice: number,
  _options?: PlatformFeeOptions,
): number {
  return computeFixedBeezioPlatformFee(finalAdvertisedPrice);
}

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

/**
 * The PayPal Payouts API currently charges Beezio $0.25 for each USD payout
 * transaction. Recipients do not pay this fee. Beezio must reserve it as an
 * operating expense rather than deducting it from a seller/affiliate/
 * influencer's promised payout.
 */
export function computePayPalPayoutFee(recipientCount: number): number {
  const count = Math.max(0, Math.floor(Number(recipientCount || 0)));
  return toMoney(count * PAYPAL_PAYOUT_API_FEE_USD);
}
