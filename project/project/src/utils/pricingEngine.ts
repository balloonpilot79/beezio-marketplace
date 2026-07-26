import {
  PROCESSING_FIXED_FEE,
  PROCESSING_PERCENT,
  PayoutSettings,
} from '../config/beezioConfig';
import { computeFixedTierPricing } from '../../shared/customerPrice';
import { computeFixedBeezioPlatformFee } from '../../shared/beezioFee';
import { getInfluencerReserveTotal } from '../../shared/referralBonus';

const round2 = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const getInfluencerBonusPool = (finalAdvertisedPrice: number): number =>
  getInfluencerReserveTotal(finalAdvertisedPrice);

export interface PayoutBreakdown {
  finalPrice: number;
  sellerAmount: number;
  affiliateAmount: number;
  platformGrossAmount: number;
  referralAffiliateAmount: number;
  beezioNetAmount: number;
  processingPercentAmount: number;
  processingFixedFee: number;
}

export function computeListingPrice(
  ask: number,
  partnerRate: number,
  _influencerActive: boolean,
  paypalPct: number,
  paypalFixed: number,
  payoutBuffer: number,
): number {
  const sellerPayout = Math.max(0, Number(ask || 0));
  const affiliatePayout = round2(
    sellerPayout * Math.max(0, Number(partnerRate || 0))
  );
  return computeFixedTierPricing({
    sellerPayout,
    affiliatePayout,
    paypalPercent: Math.max(0, Number(paypalPct || 0)),
    paypalFixed: Math.max(0, Number(paypalFixed || 0)),
    payoutBuffer: Math.max(0, Number(payoutBuffer || 0)),
  }).finalAdvertisedPrice;
}

export function calculateFinalPrice(
  askPrice: number,
  payout: PayoutSettings
): number {
  const sellerPayout = Math.max(0, Number(askPrice || 0));
  const affiliatePayout = round2(
    sellerPayout * (Math.max(0, Number(payout.affiliatePercent || 0)) / 100)
  );
  return computeFixedTierPricing({
    sellerPayout,
    affiliatePayout,
    paypalPercent: PROCESSING_PERCENT / 100,
    paypalFixed: PROCESSING_FIXED_FEE,
  }).finalAdvertisedPrice;
}

export function deriveAskPriceFromFinalPrice(
  finalPrice: number,
  payout: PayoutSettings
): number {
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) return 0;
  let low = 0;
  let high = Math.max(finalPrice, 100);
  let ask = 0;
  for (let index = 0; index < 40; index += 1) {
    const mid = (low + high) / 2;
    const computed = calculateFinalPrice(mid, payout);
    if (computed > finalPrice) high = mid;
    else low = mid;
    ask = mid;
  }
  return round2(ask);
}

export function computePayoutBreakdown(
  finalPrice: number,
  askPrice: number,
  payout: PayoutSettings,
  _options?: { referralOverrideEnabled?: boolean },
): PayoutBreakdown {
  const sellerAmount = round2(Math.max(0, Number(askPrice || 0)));
  const affiliateAmount = round2(
    sellerAmount * (Math.max(0, Number(payout.affiliatePercent || 0)) / 100)
  );
  const processingPercentAmount = round2(
    Math.max(0, Number(finalPrice || 0)) * (PROCESSING_PERCENT / 100)
  );
  const platformGrossAmount = computeFixedBeezioPlatformFee(finalPrice);

  return {
    finalPrice: round2(finalPrice),
    sellerAmount,
    affiliateAmount,
    platformGrossAmount,
    referralAffiliateAmount: 0,
    // PayPal is funded by a separate allowance in the advertised price and
    // never reduces the fixed Beezio platform fee.
    beezioNetAmount: platformGrossAmount,
    processingPercentAmount,
    processingFixedFee: PROCESSING_FIXED_FEE,
  };
}
