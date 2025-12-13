import {
  AffiliateCommissionType,
  REFERRAL_PERCENT,
  STRIPE_FLAT,
  STRIPE_PERCENT,
  calculateCustomerProductPrice,
  deriveSellerAskFromSalePrice,
  formatCurrency as formatCurrencyUtil,
  getAffiliateAmount,
  getPlatformRate,
  roundToCurrency,
} from '../utils/pricing';

export interface PricingBreakdown {
  sellerAmount: number;
  affiliateAmount: number;
  referralAmount: number;
  platformFee: number;
  stripeFee: number;
  listingPrice: number;
  taxAmount?: number;
  affiliateRate: number;
  affiliateType: 'percentage' | 'flat_rate';
  referralRate: number;
  platformFeeRate: number;
}

export interface PricingInput {
  sellerDesiredAmount: number;
  affiliateRate: number;
  affiliateType: 'percentage' | 'flat_rate';
  referralRate?: number;
  platformFeeRate?: number;
}

// Constants (align with unified pricing helper)
export const DEFAULT_PLATFORM_FEE_RATE = 0.15;
export const MIN_PLATFORM_FEE_RATE = 0.10;
export const MAX_PLATFORM_FEE_RATE = 0.15;
export const STRIPE_FEE_RATE = STRIPE_PERCENT;
export const STRIPE_FEE_FIXED = STRIPE_FLAT;
export const DEFAULT_REFERRAL_RATE = REFERRAL_PERCENT;
export const MIN_REFERRAL_RATE = REFERRAL_PERCENT;
export const MAX_REFERRAL_RATE = REFERRAL_PERCENT;
// No baked-in tax in the new formula; keep 0 for compatibility
export const TAX_RATE = 0;

export const calculatePricing = (input: PricingInput): PricingBreakdown => {
  const {
    sellerDesiredAmount,
    affiliateRate,
    affiliateType,
    referralRate = DEFAULT_REFERRAL_RATE,
    platformFeeRate,
  } = input;

  const normalizedAffiliateType: AffiliateCommissionType =
    affiliateType === 'flat_rate' ? 'flat' : 'percent';

  const platformRate = platformFeeRate ?? getPlatformRate(sellerDesiredAmount);
  const affiliateAmount = roundToCurrency(
    getAffiliateAmount(sellerDesiredAmount, normalizedAffiliateType, affiliateRate)
  );
  const platformFee = roundToCurrency(sellerDesiredAmount * platformRate);
  const listingPrice = calculateCustomerProductPrice(
    sellerDesiredAmount,
    normalizedAffiliateType,
    affiliateRate
  );
  const stripeFee = roundToCurrency(listingPrice * STRIPE_PERCENT + STRIPE_FLAT);
  const referralAmount = roundToCurrency(sellerDesiredAmount * referralRate);

  return {
    sellerAmount: sellerDesiredAmount,
    affiliateAmount,
    referralAmount,
    platformFee,
    stripeFee,
    listingPrice,
    taxAmount: 0,
    affiliateRate,
    affiliateType,
    referralRate,
    platformFeeRate: platformRate,
  };
};

export const calculateSellerPayout = (breakdown: PricingBreakdown): number => breakdown.sellerAmount;

export const calculateAffiliatePayout = (breakdown: PricingBreakdown): number =>
  breakdown.affiliateAmount;

export const calculatePlatformRevenue = (breakdown: PricingBreakdown): number =>
  breakdown.platformFee;

export const reverseCalculateFromListingPrice = (
  listingPrice: number,
  affiliateRate: number,
  affiliateType: 'percentage' | 'flat_rate',
  referralRate: number = DEFAULT_REFERRAL_RATE,
  platformFeeRate: number = DEFAULT_PLATFORM_FEE_RATE
): PricingBreakdown => {
  // Iteratively derive seller ask to match the given listing price
  let low = 0;
  let high = Math.max(listingPrice, 1000);
  let sellerAsk = 0;

  const normalizedAffiliateType: AffiliateCommissionType =
    affiliateType === 'flat_rate' ? 'flat' : 'percent';

  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    const computedPrice = calculateCustomerProductPrice(mid, normalizedAffiliateType, affiliateRate);
    if (computedPrice > listingPrice) {
      high = mid;
    } else {
      low = mid;
    }
    sellerAsk = mid;
  }

  return calculatePricing({
    sellerDesiredAmount: roundToCurrency(sellerAsk),
    affiliateRate,
    affiliateType,
    referralRate,
    platformFeeRate,
  });
};

export const formatPricingBreakdown = (
  breakdown: PricingBreakdown,
  currency: string = 'USD'
): {
  seller: string;
  affiliate: string;
  referral: string;
  platform: string;
  stripe: string;
  tax: string;
  total: string;
} => {
  const formatter = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return {
    seller: formatter(breakdown.sellerAmount),
    affiliate: formatter(breakdown.affiliateAmount),
    referral: formatter(breakdown.referralAmount),
    platform: formatter(breakdown.platformFee),
    stripe: formatter(breakdown.stripeFee),
    tax: formatter(breakdown.taxAmount || 0),
    total: formatter(breakdown.listingPrice),
  };
};

export const validatePricingInput = (input: PricingInput): string[] => {
  const errors: string[] = [];

  if (input.sellerDesiredAmount <= 0) {
    errors.push('Seller desired amount must be greater than 0');
  }

  if (input.affiliateRate < 0) {
    errors.push('Affiliate rate cannot be negative');
  }

  if (input.affiliateType === 'percentage' && input.affiliateRate > 100) {
    errors.push('Affiliate percentage cannot exceed 100%');
  }

  return errors;
};

export const getRecommendedAffiliateRates = (sellerAmount: number): {
  low: number;
  medium: number;
  high: number;
} => {
  if (sellerAmount < 50) {
    return { low: 10, medium: 15, high: 25 };
  }
  if (sellerAmount < 200) {
    return { low: 8, medium: 12, high: 20 };
  }
  return { low: 5, medium: 10, high: 15 };
};

// Re-export helper so callers can align formatting
export const formatCurrency = formatCurrencyUtil;
