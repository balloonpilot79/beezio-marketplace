import { formatCurrency as formatCurrencyUtil, roundToCurrency } from '../utils/pricing';
import { computeFixedTierPricing } from '../../shared/customerPrice';
import {
  TEST_ITEM_BEEZIO_FEE,
  TEST_ITEM_INFLUENCER_FEE,
  TEST_ITEM_PRICE,
  TEST_ITEM_PROCESSING_FEE,
} from '../../shared/testItemPricing';

export interface PricingBreakdown {
  supplierCost: number;
  sellerMarkup: number;
  sellerBaseAmount: number;
  shippingIncludedAmount: number;
  sellerAmount: number;
  sellerPayableAmount: number;
  affiliateAmount: number;
  referralAmount: number;
  influencerPerSlot: number;
  platformFee: number;
  processingFee: number;
  listingPrice: number;
  taxAmount: number;
  estimatedCheckoutTotal: number;
  affiliateRate: number;
  affiliateType: 'flat_rate';
  referralRate: number;
  platformFeeRate: number;
  pricingIterations: number;
}

export interface PricingInput {
  supplierCost?: number;
  sellerMarkup?: number;
  sellerDesiredAmount?: number;
  affiliateRate: number;
  affiliateType?: 'percentage' | 'flat_rate';
  shippingIncludedAmount?: number;
  referralRate?: number;
  platformFeeRate?: number;
  estimatedTaxRate?: number;
  testItem?: boolean;
}

export const DEFAULT_PLATFORM_FEE_RATE = 0;
export const MIN_PLATFORM_FEE_RATE = 0;
export const MAX_PLATFORM_FEE_RATE = 0;
export const PROCESSING_FEE_RATE = 0.0399;
export const PROCESSING_FEE_FIXED = 0.6;
export const MIN_AFFILIATE_PAYOUT = 5;
export const DEFAULT_REFERRAL_RATE = 0;
export const MIN_REFERRAL_RATE = 0;
export const MAX_REFERRAL_RATE = 0;

// This is a preview only. Checkout uses the configured location-based tax
// calculation and persists the actual tax separately from every earnings pool.
export const TAX_RATE = (() => {
  const raw = (import.meta as any)?.env?.VITE_TAX_RATE;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return Math.max(0, parsed);
  return 0.07;
})();

export const calculatePricing = (input: PricingInput): PricingBreakdown => {
  const supplierCost = roundToCurrency(Math.max(0, Number(input.supplierCost || 0)));
  const explicitMarkup = Number(input.sellerMarkup);
  const explicitSellerPayout = Number(input.sellerDesiredAmount);
  const sellerMarkup = roundToCurrency(
    Number.isFinite(explicitMarkup)
      ? Math.max(0, explicitMarkup)
      : Math.max(0, (Number.isFinite(explicitSellerPayout) ? explicitSellerPayout : 0) - supplierCost)
  );
  const sellerAmount = roundToCurrency(
    Number.isFinite(explicitSellerPayout)
      ? Math.max(0, explicitSellerPayout)
      : supplierCost + sellerMarkup
  );
  const shippingIncludedAmount = roundToCurrency(
    Math.max(0, Number(input.shippingIncludedAmount || 0))
  );
  const affiliateAmount = roundToCurrency(Math.max(0, Number(input.affiliateRate || 0)));

  if (input.testItem) {
    const taxAmount = roundToCurrency(TEST_ITEM_PRICE * (input.estimatedTaxRate ?? TAX_RATE));
    return {
      supplierCost,
      sellerMarkup,
      sellerBaseAmount: sellerAmount,
      shippingIncludedAmount,
      sellerAmount,
      sellerPayableAmount: roundToCurrency(sellerAmount + shippingIncludedAmount),
      affiliateAmount,
      referralAmount: roundToCurrency(TEST_ITEM_INFLUENCER_FEE * 2),
      influencerPerSlot: TEST_ITEM_INFLUENCER_FEE,
      platformFee: TEST_ITEM_BEEZIO_FEE,
      processingFee: TEST_ITEM_PROCESSING_FEE,
      listingPrice: TEST_ITEM_PRICE,
      taxAmount,
      estimatedCheckoutTotal: roundToCurrency(TEST_ITEM_PRICE + taxAmount),
      affiliateRate: affiliateAmount,
      affiliateType: 'flat_rate',
      referralRate: 0,
      platformFeeRate: 0,
      pricingIterations: 1,
    };
  }

  const calculated = computeFixedTierPricing({
    supplierCost,
    sellerMarkup,
    sellerPayout: sellerAmount,
    affiliatePayout: affiliateAmount,
    shippingIncluded: shippingIncludedAmount,
    paypalPercent: PROCESSING_FEE_RATE,
    paypalFixed: PROCESSING_FEE_FIXED,
    estimatedTaxRate: input.estimatedTaxRate ?? TAX_RATE,
  });

  return {
    supplierCost,
    sellerMarkup,
    sellerBaseAmount: sellerAmount,
    shippingIncludedAmount,
    sellerAmount,
    sellerPayableAmount: roundToCurrency(sellerAmount + shippingIncludedAmount),
    affiliateAmount: calculated.affiliatePayout,
    referralAmount: calculated.influencerAllocation,
    influencerPerSlot: calculated.influencerPerSlot,
    platformFee: calculated.platformFee,
    processingFee: calculated.paypalProcessingAllowance,
    listingPrice: calculated.finalAdvertisedPrice,
    taxAmount: calculated.estimatedSalesTax,
    estimatedCheckoutTotal: calculated.estimatedCheckoutTotal,
    affiliateRate: calculated.affiliatePayout,
    affiliateType: 'flat_rate',
    referralRate: 0,
    platformFeeRate: 0,
    pricingIterations: calculated.iterations,
  };
};

export const calculateSellerPayout = (breakdown: PricingBreakdown): number =>
  breakdown.sellerPayableAmount;

export const calculateAffiliatePayout = (breakdown: PricingBreakdown): number =>
  breakdown.affiliateAmount;

export const calculatePlatformRevenue = (breakdown: PricingBreakdown): number =>
  breakdown.platformFee;

export const reverseCalculateFromListingPrice = (
  listingPrice: number,
  affiliateRate: number,
  _affiliateType: 'percentage' | 'flat_rate',
  referralRate: number = DEFAULT_REFERRAL_RATE,
  _platformFeeRate: number = DEFAULT_PLATFORM_FEE_RATE
): PricingBreakdown => {
  let low = 0;
  let high = Math.max(listingPrice, 1000);
  let sellerPayout = 0;

  for (let index = 0; index < 40; index += 1) {
    const mid = (low + high) / 2;
    const computed = calculatePricing({
      sellerDesiredAmount: mid,
      affiliateRate,
      affiliateType: 'flat_rate',
      shippingIncludedAmount: 0,
      estimatedTaxRate: 0,
    });
    if (computed.listingPrice > listingPrice) high = mid;
    else low = mid;
    sellerPayout = mid;
  }

  return calculatePricing({
    supplierCost: 0,
    sellerMarkup: roundToCurrency(sellerPayout),
    sellerDesiredAmount: roundToCurrency(sellerPayout),
    affiliateRate,
    affiliateType: 'flat_rate',
    shippingIncludedAmount: 0,
    referralRate,
  });
};

export const formatPricingBreakdown = (
  breakdown: PricingBreakdown,
  currency: string = 'USD'
) => {
  const formatter = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

  return {
    seller: formatter(breakdown.sellerAmount),
    affiliate: formatter(breakdown.affiliateAmount),
    referral: formatter(breakdown.referralAmount),
    platform: formatter(breakdown.platformFee),
    processing: formatter(breakdown.processingFee),
    tax: formatter(breakdown.taxAmount),
    total: formatter(breakdown.listingPrice),
  };
};

export const validatePricingInput = (input: PricingInput): string[] => {
  const errors: string[] = [];
  const sellerPayout = Number(input.sellerDesiredAmount ?? 0);
  if (sellerPayout <= 0 && Number(input.supplierCost || 0) + Number(input.sellerMarkup || 0) <= 0) {
    errors.push('Supplier cost plus seller markup must be greater than 0');
  }
  if (input.affiliateRate < 0) errors.push('Affiliate payout cannot be negative');
  if (input.affiliateRate > 0 && input.affiliateRate < MIN_AFFILIATE_PAYOUT) {
    errors.push(`Affiliate payout must be at least $${MIN_AFFILIATE_PAYOUT.toFixed(2)} when affiliates are enabled`);
  }
  if (input.shippingIncludedAmount && input.shippingIncludedAmount < 0) {
    errors.push('Shipping cannot be negative');
  }
  return errors;
};

// Retained for older calculator UI; values are fixed-dollar suggestions.
export const getRecommendedAffiliateRates = (sellerAmount: number) => {
  if (sellerAmount < 50) return { low: 5, medium: 7, high: 10 };
  if (sellerAmount < 200) return { low: 5, medium: 10, high: 20 };
  return { low: 10, medium: 20, high: 35 };
};

export const formatCurrency = formatCurrencyUtil;
