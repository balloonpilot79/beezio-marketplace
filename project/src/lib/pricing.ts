// Pricing calculation utilities for Beezio platform
// Seller sets desired profit, all fees calculated on top

export interface PricingBreakdown {
  sellerAmount: number;        // What seller wants to make
  affiliateAmount: number;     // Affiliate commission
  platformFee: number;         // Beezio 10% platform fee
  stripeFee: number;          // Stripe 3% processing fee
  listingPrice: number;       // Final price customer pays
  taxAmount?: number;         // Fixed tax amount included in listing
  affiliateRate: number;      // Affiliate commission rate/amount
  affiliateType: 'percentage' | 'flat_rate';
}

export interface PricingInput {
  sellerDesiredAmount: number;
  affiliateRate: number;
  affiliateType: 'percentage' | 'flat_rate';
}

// Platform constants
export const PLATFORM_FEE_RATE = 0.10; // 10% platform fee (Beezio) - NOT USED in new formula
export const STRIPE_FEE_RATE = 0.03;   // 3% Stripe fee
export const STRIPE_FEE_FIXED = 0.60;  // $0.60 fixed Stripe fee
// Fixed sales tax applied to orders (flat $0.07 per order)
// Sales tax rate (7% = 0.07)
export const TAX_RATE = 0.07;

/**
 * Calculate complete pricing breakdown (CORRECTED FORMULA)
 * Formula: Listing Price = (Seller + Affiliate + Stripe) + Beezio
 * Where: Beezio = 10% of (Seller + Affiliate + Stripe)
 *
 * 1. Seller gets 100% of their desired amount (no fees deducted)
 * 2. Affiliate commission: seller's choice % or flat rate (added on top)
 * 3. Stripe fee: 3% of (seller + affiliate) + $0.60 (added on top)
 * 4. Beezio platform fee: 10% of (seller + affiliate + stripe)
 * 5. Final listing price = (seller + affiliate + stripe) + Beezio
 */
export const calculatePricing = (input: PricingInput): PricingBreakdown => {
  const { sellerDesiredAmount, affiliateRate, affiliateType } = input;

  // Step 1: Seller amount (they get 100% of what they want)
  const sellerAmount = sellerDesiredAmount;

  // Step 2: Affiliate commission
  let affiliateAmount = 0;
  if (affiliateType === 'percentage') {
    affiliateAmount = sellerAmount * (affiliateRate / 100);
  } else {
    affiliateAmount = affiliateRate; // Flat rate
  }

  // Step 3: Stripe fee (3% of seller+affiliate + $0.60)
  const stripeBase = sellerAmount + affiliateAmount;
  const stripeFee = stripeBase * STRIPE_FEE_RATE + STRIPE_FEE_FIXED;

  // Step 4: Beezio gets 10% of (seller + affiliate + stripe)
  const totalBeforePlatform = sellerAmount + affiliateAmount + stripeFee;
  const platformFee = totalBeforePlatform * 0.10; // Beezio gets 10%

  // Step 5: Final listing price = (seller + affiliate + stripe) + Beezio
  // compute tax on subtotal (before platform fee): typically tax applies to goods+affiliate but not platform markup; here we apply tax to (seller + affiliate + stripe?)
  // Common approach: tax applies to the taxable amount (seller + affiliate). We'll compute tax on (seller + affiliate).
  const taxableBase = sellerAmount + affiliateAmount;
  const rawTax = taxableBase * TAX_RATE;
  // round to cents
  const taxAmount = Math.round(rawTax * 100) / 100;

  const listingPrice = totalBeforePlatform + platformFee + taxAmount;

  return {
    sellerAmount,
    affiliateAmount,
    platformFee,
    stripeFee,
    taxAmount,
    // Note: listingPrice now includes the tax amount
    listingPrice,
    affiliateRate,
    affiliateType,
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
 * New Formula: Listing Price = (Seller + Affiliate + Stripe) × 1.10
 * Where: Beezio = 10% of (Seller + Affiliate + Stripe)
 * Solve for Seller amount when given listing price
 */
export const reverseCalculateFromListingPrice = (
  listingPrice: number,
  affiliateRate: number,
  affiliateType: 'percentage' | 'flat_rate'
): PricingBreakdown => {
  // listing_price = (seller + affiliate + stripe) × 1.10
  // So: seller + affiliate + stripe = listing_price / 1.10
  const totalCosts = listingPrice / 1.10;
  let sellerAmount: number;

  if (affiliateType === 'flat_rate') {
    const affiliateAmount = affiliateRate;
    // totalCosts = seller + affiliate + stripe
    // stripe = (seller + affiliate) * 0.03 + 0.60
    // So: seller = totalCosts - affiliate - stripe
    // But stripe depends on seller, so we need to solve iteratively
    let estimatedSeller = totalCosts - affiliateAmount;
    let stripeFee = (estimatedSeller + affiliateAmount) * STRIPE_FEE_RATE + STRIPE_FEE_FIXED;
    sellerAmount = totalCosts - affiliateAmount - stripeFee;

    // Refine the calculation
    for (let i = 0; i < 5; i++) {
      stripeFee = (sellerAmount + affiliateAmount) * STRIPE_FEE_RATE + STRIPE_FEE_FIXED;
      sellerAmount = totalCosts - affiliateAmount - stripeFee;
    }
  } else {
    // Percentage affiliate commission
    // totalCosts = seller + (seller * affiliateRate/100) + ((seller + seller*affiliateRate/100) * 0.03 + 0.60)
    // totalCosts = seller * (1 + affiliateRate/100) + (seller * (1 + affiliateRate/100)) * 0.03 + 0.60
    // totalCosts = seller * (1 + affiliateRate/100) * 1.03 + 0.60
    const multiplier = (1 + affiliateRate/100) * 1.03;
    sellerAmount = (totalCosts - STRIPE_FEE_FIXED) / multiplier;
  }

  return calculatePricing({
    sellerDesiredAmount: sellerAmount,
    affiliateRate,
    affiliateType,
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