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
  referralAffiliateAmount: number; // 5% slice of sale, funded from platform fee
  beezioNetAmount: number; // platformGross - referral
  fundraiserAmount: number;
  stripePercentAmount: number;
  stripeFixedFee: number;
}

/**
 * Calculate the customer-facing price that fully covers seller ask, affiliate, platform,
 * optional fundraiser share, and Stripe fees. This follows the Beezio formula:
 * F = (A + f_stripe) / (1 - (p_aff + p_platform + p_fundraiser + p_stripe))
 */
export function calculateFinalPrice(askPrice: number, payout: PayoutSettings): number {
  const affiliatePercent = payout.affiliatePercent ?? 0;
  const platformPercent = payout.platformPercent ?? PLATFORM_FEE_PERCENT;
  const fundraiserPercent = payout.fundraiserPercent ?? 0;

  const pAff = affiliatePercent / 100;
  const pPlatform = platformPercent / 100;
  const pFundraiser = fundraiserPercent / 100;
  const pStripe = STRIPE_PERCENT / 100;

  const feePortion = pAff + pPlatform + pFundraiser + pStripe;
  const denominator = 1 - feePortion;
  if (denominator <= 0) {
    throw new Error('BEEZIO_PRICING_ENGINE: invalid fee configuration; denominator <= 0');
  }

  const platformFixedSurcharge = getPlatformFixedSurcharge(askPrice);
  const finalPriceRaw = (askPrice + STRIPE_FIXED_FEE + platformFixedSurcharge) / denominator;
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
 * Inverse of calculateFinalPrice:
 * A = (F * (1 - (p_aff + p_platform + p_fundraiser + p_stripe))) - f_stripe
 */
export function deriveAskPriceFromFinalPrice(finalPrice: number, payout: PayoutSettings): number {
  const affiliatePercent = payout.affiliatePercent ?? 0;
  const platformPercent = payout.platformPercent ?? PLATFORM_FEE_PERCENT;
  const fundraiserPercent = payout.fundraiserPercent ?? 0;

  const pAff = affiliatePercent / 100;
  const pPlatform = platformPercent / 100;
  const pFundraiser = fundraiserPercent / 100;
  const pStripe = STRIPE_PERCENT / 100;

  const feePortion = pAff + pPlatform + pFundraiser + pStripe;

  // Because low-price items include a fixed $1 platform surcharge, the inverse is piecewise.
  // We compute both candidates and choose the one consistent with the surcharge rule.
  const askNoSurcharge = finalPrice * (1 - feePortion) - STRIPE_FIXED_FEE;
  const askWithSurcharge = finalPrice * (1 - feePortion) - STRIPE_FIXED_FEE - PLATFORM_FEE_UNDER_20_SURCHARGE;

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

  const affiliateAmount = roundToTwo(finalPrice * (affiliatePercent / 100));
  const platformFixedSurcharge = getPlatformFixedSurcharge(askPrice);
  const platformGrossAmount = roundToTwo(finalPrice * (platformPercent / 100) + platformFixedSurcharge);
  const referralAffiliateAmount = options?.referralOverrideEnabled
    ? roundToTwo(finalPrice * (REFERRAL_OVERRIDE_PERCENT_OF_SALE / 100))
    : 0;
  const beezioNetAmount = roundToTwo(platformGrossAmount - referralAffiliateAmount);
  const fundraiserAmount = roundToTwo(finalPrice * (fundraiserPercent / 100));
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
