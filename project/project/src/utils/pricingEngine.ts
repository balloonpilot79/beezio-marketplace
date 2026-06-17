import {
  PayoutSettings,
  PLATFORM_FEE_PERCENT,
  REFERRAL_OVERRIDE_PERCENT_OF_SALE,
  PROCESSING_FIXED_FEE,
  PROCESSING_PERCENT,
  MIN_PLATFORM_FEE,
  MIN_AFFILIATE_PAYOUT,
} from '../config/beezioConfig';
import { computeBeezioPlatformFee, computeBeezioPlatformPoolForPrice } from '../../shared/beezioFee';
import { getInfluencerReserveTotal } from '../../shared/referralBonus';

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundUpToTwo = (value: number) => Math.ceil((value + Number.EPSILON) * 100) / 100;
const isDevRuntime = () => {
  try {
    return Boolean((import.meta as any)?.env?.DEV);
  } catch {
    return false;
  }
};

interface FeeComponents {
  affiliateAmount: number;
  platformAmount: number;
}

const getNormalizedPercent = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
};

export const getInfluencerBonusPool = (askPrice: number): number => {
  const normalizedAsk = Number.isFinite(askPrice) ? Math.max(0, askPrice) : 0;
  return roundToTwo(getInfluencerReserveTotal(normalizedAsk));
};

const buildFeeComponents = (askPrice: number, payout: PayoutSettings): FeeComponents => {
  const normalizedAsk = Math.max(0, askPrice);
  const affiliatePercent = getNormalizedPercent(payout.affiliatePercent, 0);
  const platformPercent = getNormalizedPercent(payout.platformPercent, PLATFORM_FEE_PERCENT);

  const affiliateDecimal = affiliatePercent / 100;
  const platformDecimal = platformPercent / 100;

  const rawAffiliateAmount = normalizedAsk * affiliateDecimal;
  const affiliateAmount =
    affiliateDecimal > 0
      ? roundToTwo(Math.max(rawAffiliateAmount, MIN_AFFILIATE_PAYOUT))
      : 0;

  const platformAmount = roundToTwo(
    computeBeezioPlatformFee(normalizedAsk, {
      rate: platformDecimal,
      minimum: MIN_PLATFORM_FEE,
    })
  );

  return {
    affiliateAmount,
    platformAmount,
  };
};

const buildFeeComponentsForListingPrice = (
  askPrice: number,
  payout: PayoutSettings,
  paypalPercent: number,
  paypalFixed: number,
): FeeComponents => {
  const base = buildFeeComponents(askPrice, payout);
  const influencerReserve = getInfluencerBonusPool(askPrice);
  const platformPercent = getNormalizedPercent(payout.platformPercent, PLATFORM_FEE_PERCENT);
  return {
    affiliateAmount: base.affiliateAmount,
    platformAmount: roundToTwo(
      computeBeezioPlatformPoolForPrice({
        sellerAsk: askPrice,
        affiliateAmount: base.affiliateAmount,
        influencerReserve,
        paypalPercent,
        paypalFixed,
        rate: platformPercent / 100,
      })
    ),
  };
};

export interface PayoutBreakdown {
  finalPrice: number;
  sellerAmount: number;
  affiliateAmount: number;
  platformGrossAmount: number; // gross Beezio fee including reserved influencer pool before downstream payouts
  referralAffiliateAmount: number; // slice of platform fee, funded from platform fee
  beezioNetAmount: number; // platformGross - referral
  processingPercentAmount: number;
  processingFixedFee: number;
}

/**
 * PayPal MVP listing price formula (pre tax/shipping).
 *
 * Spec:
 *   b = 0.15
 *   q = influencerActive ? 0.05 : 0 (funded from platform fee; not directly in denominator)
 *   L = (A + f + d) / (1 - c - b - p)
 *
 * Where:
 *   A = seller ask
 *   c = partnerRate (decimal)
 *   p = PayPal percent fee (decimal)
 *   f = PayPal fixed fee (USD)
 *   d = payout buffer (USD)
 */
export function computeListingPrice(
  ask: number,
  partnerRate: number,
  influencerActive: boolean,
  paypalPct: number,
  paypalFixed: number,
  payoutBuffer: number,
): number {
  const A = Number.isFinite(ask) ? Math.max(0, ask) : 0;
  const c = Number.isFinite(partnerRate) ? Math.max(0, partnerRate) : 0;
  const b = PLATFORM_FEE_PERCENT / 100;
  const p = Number.isFinite(paypalPct) ? Math.max(0, paypalPct) : 0;
  const f = Number.isFinite(paypalFixed) ? Math.max(0, paypalFixed) : 0;
  const d = Number.isFinite(payoutBuffer) ? Math.max(0, payoutBuffer) : 0;
  const influencerReserve = getInfluencerBonusPool(A);

  void influencerActive;

  if (A >= 25) {
    const affiliateAmount = A * c;
    const platformAmount = computeBeezioPlatformPoolForPrice({
      sellerAsk: A,
      affiliateAmount,
      influencerReserve,
      paypalPercent: p,
      paypalFixed: f,
      rate: b,
    });
    return roundUpToTwo(A + affiliateAmount + influencerReserve + platformAmount + d);
  }

  const denom = 1 - p;
  if (denom <= 0) {
    throw new Error('BEEZIO_PRICING_ENGINE.computeListingPrice: invalid fee configuration; denominator <= 0');
  }
  const affiliateAmount = A * c;
  const platformAmount = computeBeezioPlatformPoolForPrice({
    sellerAsk: A,
    affiliateAmount,
    influencerReserve,
    paypalPercent: p,
    paypalFixed: f,
    rate: b,
  });
  const raw = (A + affiliateAmount + platformAmount + influencerReserve + f + d) / denom;
  return roundUpToTwo(raw);
}

/**
 * Calculate the customer-facing price that fully covers seller ask, affiliate, platform,
 * and payment processing fees.
 *
 * Unified model (ask-based fees):
 * - Affiliate/platform amounts are derived from the seller ask (not the final price)
 * - Processing is baked into the buyer price (paid by buyer)
 *
 * Let:
 *   A = askPrice
 *   Aff = A * p_aff
 *   Plat = capped fee based on seller ask
 *   NetTarget = A + Aff + Plat
 *   F = (NetTarget + processing_fixed) / (1 - processing_percent)
 */
export function calculateFinalPrice(askPrice: number, payout: PayoutSettings): number {
  const affiliatePercent = getNormalizedPercent(payout.affiliatePercent, 0);
  const pProcessing = PROCESSING_PERCENT / 100;
  const denominator = 1 - pProcessing;
  if (denominator <= 0) {
    throw new Error('BEEZIO_PRICING_ENGINE: invalid fee configuration; denominator <= 0');
  }

  const { affiliateAmount, platformAmount } = buildFeeComponentsForListingPrice(
    askPrice,
    payout,
    PROCESSING_PERCENT / 100,
    PROCESSING_FIXED_FEE
  );
  const influencerReserve = getInfluencerBonusPool(askPrice);
  const targetNetAfterProcessing = askPrice + affiliateAmount + platformAmount + influencerReserve;
  const finalPriceRaw = askPrice >= 25
    ? targetNetAfterProcessing
    : (targetNetAfterProcessing + PROCESSING_FIXED_FEE) / denominator;
  // IMPORTANT: round UP so processing fees are always fully covered.
  const finalPrice = roundUpToTwo(finalPriceRaw);

  if (isDevRuntime()) {
    console.debug('BEEZIO_PRICING_ENGINE.calculateFinalPrice', {
      askPrice,
      affiliatePercent,
      platformPercent: getNormalizedPercent(payout.platformPercent, PLATFORM_FEE_PERCENT),
      finalPrice,
    });
  }

  return finalPrice;
}

/**
 * Derive the seller ask from a known customer-facing final price.
 * Inverse of calculateFinalPrice (ask-based fees):
 *
 * Let k = (1 + p_aff) * (1 + p_platform).
 * F = (A*k + processing_fixed) / (1 - p_processing)
 * A = ((F*(1 - p_processing) - processing_fixed) / k)
 */
export function deriveAskPriceFromFinalPrice(finalPrice: number, payout: PayoutSettings): number {
  if (!Number.isFinite(finalPrice) || finalPrice <= 0) return 0;

  const target = finalPrice;
  let low = 0;
  let high = Math.max(target, 100);
  let attempts = 0;
  while (calculateFinalPrice(high, payout) < target && attempts < 24) {
    high = Math.max(high * 2, 1);
    attempts += 1;
    if (high >= 1e8) break;
  }

  let ask = high;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const computed = calculateFinalPrice(mid, payout);
    if (computed > target) {
      high = mid;
    } else {
      low = mid;
    }
    ask = mid;
  }

  return roundToTwo(ask);
}

/**
 * Break down how a given final price distributes across participants.
 * Assumes finalPrice already came from calculateFinalPrice with the same payout config.
 */
export function computePayoutBreakdown(
  finalPrice: number,
  askPrice: number,
  payout: PayoutSettings,
  options?: {
    referralOverrideEnabled?: boolean;
  },
): PayoutBreakdown {
  const influencerReserve = getInfluencerBonusPool(askPrice);
  const { affiliateAmount, platformAmount } = buildFeeComponentsForListingPrice(
    askPrice,
    payout,
    PROCESSING_PERCENT / 100,
    PROCESSING_FIXED_FEE
  );
  const platformGrossAmount = roundToTwo(platformAmount + influencerReserve);
  const referralOverrideActive = Boolean(options?.referralOverrideEnabled) && REFERRAL_OVERRIDE_PERCENT_OF_SALE > 0;
  const referralAffiliateAmount = referralOverrideActive
    ? roundToTwo(platformGrossAmount * (REFERRAL_OVERRIDE_PERCENT_OF_SALE / 100))
    : 0;
  const processingPercentAmount = roundToTwo(finalPrice * (PROCESSING_PERCENT / 100));
  const processingTotal = roundToTwo(processingPercentAmount + PROCESSING_FIXED_FEE);
  const beezioNetAmount = roundToTwo(
    Math.max(platformGrossAmount - referralAffiliateAmount - (askPrice >= 25 ? processingTotal : 0), 0)
  );

  const breakdown: PayoutBreakdown = {
    finalPrice: roundToTwo(finalPrice),
    sellerAmount: roundToTwo(askPrice),
    affiliateAmount,
    platformGrossAmount,
    referralAffiliateAmount,
    beezioNetAmount,
    processingPercentAmount,
    processingFixedFee: PROCESSING_FIXED_FEE,
  };

  if (isDevRuntime()) {
    console.debug('BEEZIO_PRICING_ENGINE.computePayoutBreakdown', {
      askPrice,
      payout,
      breakdown,
    });
  }

  return breakdown;
}
