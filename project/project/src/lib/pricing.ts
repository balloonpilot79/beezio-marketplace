import {
  AffiliateCommissionType,
  REFERRAL_PERCENT,
  calculateCustomerProductPrice,
  formatCurrency as formatCurrencyUtil,
  getAffiliateAmount,
  getPlatformRate,
  roundToCurrency,
} from '../utils/pricing';
import { MIN_PLATFORM_FEE } from '../config/beezioConfig';
import { DEFAULT_BEEZIO_PLATFORM_RATE, computeBeezioPlatformFee } from '../../shared/beezioFee';
import { getInfluencerReserveTotal } from '../../shared/referralBonus';
import {
  TEST_ITEM_BEEZIO_FEE,
  TEST_ITEM_INFLUENCER_FEE,
  TEST_ITEM_PRICE,
  TEST_ITEM_PROCESSING_FEE,
} from '../../shared/testItemPricing';
import { isLowPriceAmount } from '../../shared/lowPriceFeePolicy';

export interface PricingBreakdown {
  sellerBaseAmount: number;
  shippingIncludedAmount: number;
  sellerAmount: number;
  affiliateAmount: number;
  referralAmount: number;
  platformFee: number;
  processingFee: number;
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
  shippingIncludedAmount?: number;
  referralRate?: number;
  platformFeeRate?: number;
  testItem?: boolean;
}

// Constants (align with unified pricing helper)
export const DEFAULT_PLATFORM_FEE_RATE = DEFAULT_BEEZIO_PLATFORM_RATE;
export const MIN_PLATFORM_FEE_RATE = DEFAULT_BEEZIO_PLATFORM_RATE;
export const MAX_PLATFORM_FEE_RATE = DEFAULT_BEEZIO_PLATFORM_RATE;
export const PROCESSING_FEE_RATE = 0.0399;
export const PROCESSING_FEE_FIXED = 0.6;
export const DEFAULT_REFERRAL_RATE = REFERRAL_PERCENT;
export const MIN_REFERRAL_RATE = REFERRAL_PERCENT;
export const MAX_REFERRAL_RATE = REFERRAL_PERCENT;
// Sales tax rate (decimal). Configure with VITE_TAX_RATE for live.
export const TAX_RATE = (() => {
  const raw = (import.meta as any)?.env?.VITE_TAX_RATE;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return Math.max(0, parsed);
  return 0.07;
})();

export const calculatePricing = (input: PricingInput): PricingBreakdown => {
  const {
    sellerDesiredAmount,
    affiliateRate,
    affiliateType,
    shippingIncludedAmount = 0,
    platformFeeRate,
    testItem = false,
  } = input;

  const sellerBaseAmount = roundToCurrency(Math.max(0, Number(sellerDesiredAmount) || 0));
  const includedShipping = roundToCurrency(Math.max(0, Number(shippingIncludedAmount) || 0));
  const sellerAmount = roundToCurrency(sellerBaseAmount + includedShipping);
  const normalizedAffiliateType: AffiliateCommissionType = affiliateType === 'flat_rate' ? 'flat' : 'percent';
  const platformRate = platformFeeRate ?? getPlatformRate(sellerAmount);
  const affiliateAmount = roundToCurrency(
    getAffiliateAmount(sellerAmount, normalizedAffiliateType, affiliateRate)
  );
  const platformFee = testItem
    ? TEST_ITEM_BEEZIO_FEE
    : roundToCurrency(
        computeBeezioPlatformFee(sellerAmount, {
          rate: platformRate,
          minimum: MIN_PLATFORM_FEE,
        })
      );
  const referralAmount = testItem
    ? roundToCurrency(TEST_ITEM_INFLUENCER_FEE * 2)
    : roundToCurrency(getInfluencerReserveTotal(sellerAmount));
  const targetNetAfterProcessing = sellerAmount + affiliateAmount + platformFee + referralAmount;
  const listingPrice = roundToCurrency(
    testItem
      ? TEST_ITEM_PRICE
      : calculateCustomerProductPrice(sellerAmount, normalizedAffiliateType, affiliateRate)
  );
  const processingFee = roundToCurrency(
    testItem
      ? TEST_ITEM_PROCESSING_FEE
      : isLowPriceAmount(sellerAmount)
      ? (listingPrice - targetNetAfterProcessing)
      : 0
  );

  return {
    sellerBaseAmount,
    shippingIncludedAmount: includedShipping,
    sellerAmount,
    affiliateAmount,
    referralAmount,
    platformFee,
    processingFee,
    listingPrice,
    taxAmount: 0,
    affiliateRate,
    affiliateType,
    referralRate: DEFAULT_REFERRAL_RATE,
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
    shippingIncludedAmount: 0,
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
  processing: string;
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
    processing: formatter(breakdown.processingFee),
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
