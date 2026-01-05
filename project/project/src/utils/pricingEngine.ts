import {
  PayoutSettings,
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_UNDER_20_SURCHARGE,
  PLATFORM_FEE_UNDER_20_THRESHOLD,
  REFERRAL_OVERRIDE_PERCENT_OF_SALE,
  STRIPE_FIXED_FEE,
  STRIPE_PERCENT,
} from '../config/beezioConfig';

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const getPlatformFixedSurcharge = (askPrice: number): number =>
  Number.isFinite(askPrice) && askPrice > 0 && askPrice <= PLATFORM_FEE_UNDER_20_THRESHOLD
    ? PLATFORM_FEE_UNDER_20_SURCHARGE
    : 0;

export interface PayoutBreakdown {
  finalPrice: number;
  sellerAmount: number;
  affiliateAmount: number;
  platformGrossAmount: number; // full 15%
  referralAffiliateAmount: number; // slice of platform fee, funded from platform fee
  beezioNetAmount: number; // platformGross - referral
  fundraiserAmount: number;
  stripePercentAmount: number;
  stripeFixedFee: number;
}

/**
 * Calculate the customer-facing price that fully covers seller ask, affiliate, platform,
 * optional fundraiser share, and Stripe fees.
 *
 * Unified model (ask-based fees):
 * - Affiliate/platform/fundraiser amounts are derived from the seller ask (not the final price)
 * - Stripe is charged on the final price (2.9% + $0.30)
 *
 * Let:
 *   A = askPrice
 *   S = fixed platform surcharge ($1 when A <= $20)
 *   Aff = A * p_aff
 *   Plat = A * p_platform
 *   Fund = A * p_fundraiser
 *   NetTarget = A + Aff + Plat + Fund + S
 *   F = (NetTarget + stripe_fixed) / (1 - stripe_percent)
 */
export function calculateFinalPrice(askPrice: number, payout: PayoutSettings): number {
  const affiliatePercent = payout.affiliatePercent ?? 0;
  const platformPercent = payout.platformPercent ?? PLATFORM_FEE_PERCENT;
  const fundraiserPercent = payout.fundraiserPercent ?? 0;

  const pAff = affiliatePercent / 100;
  const pPlatform = platformPercent / 100;
  const pFundraiser = fundraiserPercent / 100;
  const pStripe = STRIPE_PERCENT / 100;

  const denominator = 1 - pStripe;
  if (denominator <= 0) {
    throw new Error('BEEZIO_PRICING_ENGINE: invalid fee configuration; denominator <= 0');
  }

  const platformFixedSurcharge = getPlatformFixedSurcharge(askPrice);
  const askBasedFees = askPrice * pAff + askPrice * pPlatform + askPrice * pFundraiser;
  const targetNetAfterStripe = askPrice + askBasedFees + platformFixedSurcharge;
  const finalPriceRaw = (targetNetAfterStripe + STRIPE_FIXED_FEE) / denominator;
  const finalPrice = roundToTwo(finalPriceRaw);

  if (import.meta.env.DEV) {
    console.debug('BEEZIO_PRICING_ENGINE.calculateFinalPrice', {
      askPrice,
      affiliatePercent,
      platformPercent,
      fundraiserPercent,
      stripePercent: STRIPE_PERCENT,
      stripeFixed: STRIPE_FIXED_FEE,
      platformFixedSurcharge,
      finalPrice,
    });
  }

  return finalPrice;
}

/**
 * Derive the seller ask from a known customer-facing final price.
 * Inverse of calculateFinalPrice (ask-based fees):
 *
 * Let k = 1 + p_aff + p_platform + p_fundraiser.
 * F = (A*k + S + stripe_fixed) / (1 - p_stripe)
 * A = ((F*(1 - p_stripe) - stripe_fixed - S) / k)
 */
export function deriveAskPriceFromFinalPrice(finalPrice: number, payout: PayoutSettings): number {
  const affiliatePercent = payout.affiliatePercent ?? 0;
  const platformPercent = payout.platformPercent ?? PLATFORM_FEE_PERCENT;
  const fundraiserPercent = payout.fundraiserPercent ?? 0;

  const pAff = affiliatePercent / 100;
  const pPlatform = platformPercent / 100;
  const pFundraiser = fundraiserPercent / 100;
  const pStripe = STRIPE_PERCENT / 100;

  const k = 1 + pAff + pPlatform + pFundraiser;
  if (k <= 0) return 0;

  // Because low-price items include a fixed $1 platform surcharge, the inverse is piecewise.
  // We compute both candidates and choose the one consistent with the surcharge rule.
  const base = finalPrice * (1 - pStripe) - STRIPE_FIXED_FEE;
  const askNoSurcharge = base / k;
  const askWithSurcharge = (base - PLATFORM_FEE_UNDER_20_SURCHARGE) / k;

  const resolvedAsk =
    Number.isFinite(askWithSurcharge) && askWithSurcharge > 0 && askWithSurcharge <= PLATFORM_FEE_UNDER_20_THRESHOLD
      ? askWithSurcharge
      : askNoSurcharge;

  return roundToTwo(resolvedAsk);
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
  const affiliatePercent = payout.affiliatePercent ?? 0;
  const platformPercent = payout.platformPercent ?? PLATFORM_FEE_PERCENT;
  const fundraiserPercent = payout.fundraiserPercent ?? 0;

  const affiliateAmount = roundToTwo(askPrice * (affiliatePercent / 100));
  const platformFixedSurcharge = getPlatformFixedSurcharge(askPrice);
  const platformGrossAmount = roundToTwo(askPrice * (platformPercent / 100) + platformFixedSurcharge);
  const referralAffiliateAmount = options?.referralOverrideEnabled
    ? roundToTwo(platformGrossAmount * (REFERRAL_OVERRIDE_PERCENT_OF_SALE / 100))
    : 0;
  const beezioNetAmount = roundToTwo(platformGrossAmount - referralAffiliateAmount);
  const fundraiserAmount = roundToTwo(askPrice * (fundraiserPercent / 100));
  const stripePercentAmount = roundToTwo(finalPrice * (STRIPE_PERCENT / 100));

  const breakdown: PayoutBreakdown = {
    finalPrice: roundToTwo(finalPrice),
    sellerAmount: roundToTwo(askPrice),
    affiliateAmount,
    platformGrossAmount,
    referralAffiliateAmount,
    beezioNetAmount,
    fundraiserAmount,
    stripePercentAmount,
    stripeFixedFee: STRIPE_FIXED_FEE,
  };

  if (import.meta.env.DEV) {
    console.debug('BEEZIO_PRICING_ENGINE.computePayoutBreakdown', {
      askPrice,
      payout,
      breakdown,
    });
  }

  return breakdown;
}
