import { DEFAULT_BEEZIO_PLATFORM_RATE, computeBeezioPlatformFee } from './beezioFee';
import { getLowPriceFlatFeeTotal, isLowPriceAmount } from './lowPriceFeePolicy';
import { getInfluencerReserveTotal } from './referralBonus';

export type SharedAffiliateCommissionType = 'percent' | 'flat';

const ceil2 = (value: number): number =>
  Math.ceil((Number(value || 0) + Number.EPSILON) * 100) / 100;

const round2 = (value: number): number =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export function computeAffiliateAmountFromAsk(
  sellerAsk: number,
  affiliateType: SharedAffiliateCommissionType,
  affiliateValue: number,
): number {
  const ask = Number.isFinite(sellerAsk) ? Math.max(0, sellerAsk) : 0;
  const value = Number.isFinite(affiliateValue) ? Math.max(0, affiliateValue) : 0;
  if (ask <= 0 || value <= 0) return 0;

  if (affiliateType === 'flat') {
    return round2(value);
  }

  const normalizedPercent = value > 1 ? value / 100 : value;
  return round2(ask * Math.max(0, normalizedPercent));
}

export function computeCustomerListingPrice(params: {
  sellerAsk: number;
  affiliateType: SharedAffiliateCommissionType;
  affiliateValue: number;
  beezioRate?: number;
  paypalPercent?: number;
  paypalFixed?: number;
  payoutBuffer?: number;
}): number {
  const ask = Number.isFinite(params.sellerAsk) ? Math.max(0, params.sellerAsk) : 0;
  const paypalPercent = Number.isFinite(params.paypalPercent) ? Math.max(0, Number(params.paypalPercent)) : 0.0399;
  const paypalFixed = Number.isFinite(params.paypalFixed) ? Math.max(0, Number(params.paypalFixed)) : 0.6;
  const payoutBuffer = Number.isFinite(params.payoutBuffer) ? Math.max(0, Number(params.payoutBuffer)) : 0;
  const beezioRate = Number.isFinite(params.beezioRate) ? Math.max(0, Number(params.beezioRate)) : DEFAULT_BEEZIO_PLATFORM_RATE;

  const affiliateAmount = computeAffiliateAmountFromAsk(ask, params.affiliateType, params.affiliateValue);
  const platformFee = isLowPriceAmount(ask)
    ? round2(getLowPriceFlatFeeTotal(1))
    : round2(computeBeezioPlatformFee(ask, { rate: beezioRate }));
  const influencerReserve = round2(getInfluencerReserveTotal(ask));
  const subtotalBeforeProcessor = ask + affiliateAmount + platformFee + influencerReserve + payoutBuffer;

  if (!isLowPriceAmount(ask)) {
    return ceil2(subtotalBeforeProcessor);
  }

  const denominator = 1 - paypalPercent;
  if (denominator <= 0) {
    throw new Error('Invalid fee configuration: denominator <= 0');
  }

  return ceil2((subtotalBeforeProcessor + paypalFixed) / denominator);
}
