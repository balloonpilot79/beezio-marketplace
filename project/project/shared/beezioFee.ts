export const DEFAULT_BEEZIO_PLATFORM_RATE = 0.15;
export const DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE = 2;
export const DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD = 25;
export const DEFAULT_BEEZIO_MIN_NET_PROFIT = 2;
export const DEFAULT_BEEZIO_PLATFORM_FEE_MIN = 0;
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

export function computeBeezioPlatformFee(
  sellerAsk: number,
  options?: PlatformFeeOptions,
): number {
  const ask = Number.isFinite(sellerAsk) ? Math.max(0, sellerAsk) : 0;
  if (ask <= 0) return 0;

  const rate = Number.isFinite(options?.rate) ? Math.max(0, Number(options?.rate)) : DEFAULT_BEEZIO_PLATFORM_RATE;
  const underThresholdFlatFee = Number.isFinite(options?.underThresholdFlatFee)
    ? Math.max(0, Number(options?.underThresholdFlatFee))
    : DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE;
  const percentRateThreshold = Number.isFinite(options?.percentRateThreshold)
    ? Math.max(0, Number(options?.percentRateThreshold))
    : DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD;
  const minimum = Number.isFinite(options?.minimum) ? Math.max(0, Number(options?.minimum)) : DEFAULT_BEEZIO_PLATFORM_FEE_MIN;
  const cap = Number.isFinite(options?.cap) ? Math.max(minimum, Number(options?.cap)) : DEFAULT_BEEZIO_PLATFORM_FEE_CAP;
  const largeOrderThreshold = Number.isFinite(options?.largeOrderThreshold)
    ? Math.max(0, Number(options?.largeOrderThreshold))
    : DEFAULT_BEEZIO_LARGE_ORDER_THRESHOLD;
  const largeOrderFlatFee = Number.isFinite(options?.largeOrderFlatFee)
    ? Math.max(0, Number(options?.largeOrderFlatFee))
    : DEFAULT_BEEZIO_LARGE_ORDER_FLAT_FEE;

  if (largeOrderFlatFee > 0 && ask > largeOrderThreshold) {
    return toMoney(largeOrderFlatFee);
  }

  if (ask < percentRateThreshold) {
    return toMoney(underThresholdFlatFee);
  }

  return toMoney(Math.min(Math.max(ask * rate, minimum), cap));
}

export function computeBeezioPlatformPoolForPrice(params: {
  sellerAsk: number;
  affiliateAmount?: number;
  influencerReserve?: number;
  paypalPercent?: number;
  paypalFixed?: number;
  rate?: number;
  underThresholdFlatFee?: number;
  percentRateThreshold?: number;
  minimumNetProfit?: number;
}): number {
  const ask = Number.isFinite(params.sellerAsk) ? Math.max(0, params.sellerAsk) : 0;
  if (ask <= 0) return 0;

  const threshold = Number.isFinite(params.percentRateThreshold)
    ? Math.max(0, Number(params.percentRateThreshold))
    : DEFAULT_BEEZIO_PERCENT_RATE_THRESHOLD;
  const flatFee = Number.isFinite(params.underThresholdFlatFee)
    ? Math.max(0, Number(params.underThresholdFlatFee))
    : DEFAULT_BEEZIO_UNDER_THRESHOLD_FLAT_FEE;
  if (ask < threshold) return toMoney(flatFee);

  const rate = Number.isFinite(params.rate) ? Math.max(0, Number(params.rate)) : DEFAULT_BEEZIO_PLATFORM_RATE;
  const minNet = Number.isFinite(params.minimumNetProfit)
    ? Math.max(0, Number(params.minimumNetProfit))
    : DEFAULT_BEEZIO_MIN_NET_PROFIT;
  const paypalPercent = Number.isFinite(params.paypalPercent) ? Math.max(0, Number(params.paypalPercent)) : 0;
  const paypalFixed = Number.isFinite(params.paypalFixed) ? Math.max(0, Number(params.paypalFixed)) : 0;
  const affiliateAmount = Number.isFinite(params.affiliateAmount) ? Math.max(0, Number(params.affiliateAmount)) : 0;
  const influencerReserve = Number.isFinite(params.influencerReserve) ? Math.max(0, Number(params.influencerReserve)) : 0;
  const baseWithoutPlatform = ask + affiliateAmount + influencerReserve;
  const ratePool = ask * rate;
  const denominator = 1 - paypalPercent;
  const minPool =
    denominator > 0
      ? (minNet + paypalPercent * baseWithoutPlatform + paypalFixed) / denominator
      : Number.MAX_SAFE_INTEGER;

  return toMoney(Math.max(ratePool, minPool));
}
