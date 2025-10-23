// Pricing calculation utilities for Beezio platform
// Seller sets desired profit, all fees calculated on top

export interface PricingBreakdown {
  sellerAmount: number;        // What seller wants to make
  affiliateAmount: number;     // Affiliate commission
  referralAmount: number;      // Referral commission (2-5% for referring the seller/affiliate)
  platformFee: number;         // Beezio 10-15% platform fee (configurable)
  stripeFee: number;          // Stripe 2.9% + $0.60 processing fee
  listingPrice: number;       // Final price customer pays
  taxAmount?: number;         // Fixed tax amount included in listing
  affiliateRate: number;      // Affiliate commission rate/amount
  affiliateType: 'percentage' | 'flat_rate';
  referralRate: number;       // Referral commission rate (2-5%)
  platformFeeRate: number;    // Platform fee rate (10-15%)
}

export interface PricingInput {
  sellerDesiredAmount: number;
  affiliateRate: number;
  affiliateType: 'percentage' | 'flat_rate';
  referralRate?: number;          // Optional: 2-5% for users who were referred
  platformFeeRate?: number;       // Optional: 10-15% Beezio fee (default 10%)
}

// Platform constants
export const DEFAULT_PLATFORM_FEE_RATE = 0.15;  // 15% Beezio fee (UPDATED Oct 2025)
export const MIN_PLATFORM_FEE_RATE = 0.10;      // Minimum 10%
export const MAX_PLATFORM_FEE_RATE = 0.15;      // Maximum 15%
export const STRIPE_FEE_RATE = 0.029;           // 2.9% Stripe fee (was 3%)
export const STRIPE_FEE_FIXED = 0.60;           // $0.60 fixed Stripe fee
export const DEFAULT_REFERRAL_RATE = 0.05;      // 5% referral commission (UPDATED Oct 2025)
export const MIN_REFERRAL_RATE = 0.05;          // 5% fixed rate
export const MAX_REFERRAL_RATE = 0.05;          // 5% fixed rate
// Sales tax rate (7% = 0.07)
export const TAX_RATE = 0.07;

/**
 * Calculate complete pricing breakdown (UPDATED WITH REFERRAL TIER)
 * Formula: Listing Price = (Seller + Affiliate + Referral + Stripe) + Beezio + Tax
 * 
 * Multi-tier commission structure:
 * 1. Seller gets 100% of their desired amount (no fees deducted)
 * 2. Affiliate commission: seller's choice % or flat rate (added on top)
 * 3. Referral commission: 5% ALWAYS if affiliate was referred by someone (added on top)
 * 4. Stripe fee: 2.9% of (seller + affiliate + referral) + $0.60 (added on top)
 * 5. Beezio platform fee: 15% of (seller + affiliate + referral + stripe) [UPDATED Oct 2025]
 * 6. Tax: 7% of (seller + affiliate)
 * 7. Final listing price = sum of all above
 * 
 * REFERRAL PASSIVE INCOME:
 * - Every affiliate who signs people up using their referral codes
 * - Earns 5% commission on EVERY sale their referrals make
 * - Creates ongoing passive income stream for referring affiliates
 * 
 * Example: Seller wants $100, 15% affiliate, 5% referral, 15% Beezio
 * - Seller: $100.00
 * - Affiliate (15%): $15.00
 * - Referral (5% of $115): $5.75
 * - Stripe (2.9% of $120.75 + $0.60): $4.10
 * - Beezio (15% of $124.85): $18.73
 * - Tax (7% of $115): $8.05
 * - Total: $151.63
 */
export const calculatePricing = (input: PricingInput): PricingBreakdown => {
  const { 
    sellerDesiredAmount, 
    affiliateRate, 
    affiliateType,
    referralRate = 0,
    platformFeeRate = DEFAULT_PLATFORM_FEE_RATE
  } = input;

  // Step 1: Seller amount (they get 100% of what they want)
  const sellerAmount = sellerDesiredAmount;

  // Step 2: Affiliate commission
  let affiliateAmount = 0;
  if (affiliateType === 'percentage') {
    affiliateAmount = sellerAmount * (affiliateRate / 100);
  } else {
    affiliateAmount = affiliateRate; // Flat rate
  }

  // Step 3: Referral commission (2-5% of total sale if seller was referred)
  // Referral is calculated on the base sale amount (seller + affiliate)
  const baseAmount = sellerAmount + affiliateAmount;
  const referralAmount = baseAmount * (referralRate / 100);

  // Step 4: Stripe fee (2.9% of seller+affiliate+referral + $0.60)
  const stripeBase = sellerAmount + affiliateAmount + referralAmount;
  const stripeFee = stripeBase * STRIPE_FEE_RATE + STRIPE_FEE_FIXED;

  // Step 5: Beezio gets 10-15% of (seller + affiliate + referral + stripe)
  const totalBeforePlatform = sellerAmount + affiliateAmount + referralAmount + stripeFee;
  const platformFee = totalBeforePlatform * platformFeeRate;

  // Step 6: Tax (7% of taxable amount: seller + affiliate)
  const taxableBase = sellerAmount + affiliateAmount;
  const rawTax = taxableBase * TAX_RATE;
  const taxAmount = Math.round(rawTax * 100) / 100;

  // Step 7: Final listing price
  const listingPrice = totalBeforePlatform + platformFee + taxAmount;

  return {
    sellerAmount,
    affiliateAmount,
    referralAmount,
    platformFee,
    stripeFee,
    taxAmount,
    listingPrice,
    affiliateRate,
    affiliateType,
    referralRate,
    platformFeeRate,
  };
};

/**
 * Calculate what seller will receive after a sale
 */
export const calculateSellerPayout = (breakdown: PricingBreakdown): number => {
  return breakdown.sellerAmount; // Seller gets exactly what they wanted
};

/**
 * Calculate what affiliate will receive after a sale
 */
export const calculateAffiliatePayout = (breakdown: PricingBreakdown): number => {
  return breakdown.affiliateAmount;
};

/**
 * Calculate platform revenue from a sale
 */
export const calculatePlatformRevenue = (breakdown: PricingBreakdown): number => {
  return breakdown.platformFee;
};

/**
 * Reverse calculate seller amount from listing price
 * Updated Formula: Listing Price = (Seller + Affiliate + Referral + Stripe) × (1 + platformFeeRate) + Tax
 * Solve for Seller amount when given listing price
 */
export const reverseCalculateFromListingPrice = (
  listingPrice: number,
  affiliateRate: number,
  affiliateType: 'percentage' | 'flat_rate',
  referralRate: number = 0,
  platformFeeRate: number = DEFAULT_PLATFORM_FEE_RATE
): PricingBreakdown => {
  // This is complex due to tax, so we'll use iterative approximation
  let sellerAmount: number = 0; // Initialize to 0
  
  // Initial estimate: work backwards ignoring tax
  const estimatedBeforeTax = listingPrice * 0.93; // rough estimate removing 7% tax
  const totalCosts = estimatedBeforeTax / (1 + platformFeeRate);

  if (affiliateType === 'flat_rate') {
    const affiliateAmount = affiliateRate;
    // totalCosts = seller + affiliate + referral + stripe
    // referral = (seller + affiliate) * referralRate/100
    // stripe = (seller + affiliate + referral) * 0.029 + 0.60
    
    // Iterative solution
    let estimatedSeller = totalCosts - affiliateAmount;
    for (let i = 0; i < 10; i++) {
      const refAmount = (estimatedSeller + affiliateAmount) * (referralRate / 100);
      const stripeFee = (estimatedSeller + affiliateAmount + refAmount) * STRIPE_FEE_RATE + STRIPE_FEE_FIXED;
      sellerAmount = totalCosts - affiliateAmount - refAmount - stripeFee;
      estimatedSeller = sellerAmount;
    }
  } else {
    // Percentage affiliate commission
    // totalCosts = seller * (1 + affiliateRate/100) * (1 + referralRate/100) * (1 + 0.029) + 0.60
    const affiliateMultiplier = (1 + affiliateRate / 100);
    const referralMultiplier = (1 + referralRate / 100);
    const stripeMultiplier = (1 + STRIPE_FEE_RATE);
    const combinedMultiplier = affiliateMultiplier * referralMultiplier * stripeMultiplier;
    
    sellerAmount = (totalCosts - STRIPE_FEE_FIXED) / combinedMultiplier;
  }

  // Calculate full breakdown with the derived seller amount
  return calculatePricing({
    sellerDesiredAmount: sellerAmount,
    affiliateRate,
    affiliateType,
    referralRate,
    platformFeeRate,
  });
};

/**
 * Format pricing breakdown for display
 */
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
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });

  return {
    seller: formatter.format(breakdown.sellerAmount),
    affiliate: formatter.format(breakdown.affiliateAmount),
    referral: formatter.format(breakdown.referralAmount),
    platform: formatter.format(breakdown.platformFee),
    stripe: formatter.format(breakdown.stripeFee),
    tax: formatter.format(breakdown.taxAmount || 0),
    total: formatter.format(breakdown.listingPrice),
  };
};

/**
 * Validate pricing input
 */
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

  if (input.affiliateType === 'flat_rate' && input.affiliateRate > input.sellerDesiredAmount * 2) {
    errors.push('Affiliate flat rate seems unusually high compared to seller amount');
  }

  return errors;
};

/**
 * Get recommended affiliate rates based on product category/price
 */
export const getRecommendedAffiliateRates = (sellerAmount: number): {
  low: number;
  medium: number;
  high: number;
} => {
  // Recommendations based on seller amount
  if (sellerAmount < 50) {
    return { low: 15, medium: 25, high: 40 };
  } else if (sellerAmount < 200) {
    return { low: 10, medium: 20, high: 35 };
  } else {
    return { low: 5, medium: 15, high: 25 };
  }
};