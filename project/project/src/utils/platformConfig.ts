import { computeFixedTierPricing } from '../../shared/customerPrice';

// Platform fee configuration
// This file contains the fee structure for Beezio platform

export const PLATFORM_CONFIG = {
  // Platform fees (Beezio's revenue)
  PLATFORM_FEE_PERCENTAGE: 0,
  
  // Payment processing
  PROCESSING_FEE_PERCENTAGE: 3.99, // 3.99% + $0.60 per transaction/item
  PROCESSING_FEE_FIXED: 0.60, // $0.60 fixed fee
  
  // Affiliate commissions (default rates)
  DEFAULT_AFFILIATE_COMMISSION: 5,
  MAX_AFFILIATE_COMMISSION: Number.MAX_SAFE_INTEGER,
  
  // Payout thresholds
  MINIMUM_PAYOUT_AMOUNT: 25.00, // $25 minimum payout
  
  // Revenue types
  REVENUE_TYPES: {
    PLATFORM_FEE: 'fee',
    AFFILIATE_COMMISSION: 'commission', 
    SUBSCRIPTION: 'subscription'
  }
};

// Helper functions for fee calculations
// UPDATED FORMULA: Platform fee is based on seller ask only.
// Processing is paid by the buyer and does not affect platform fee.
export const calculateFees = (sellerDesiredAmount: number, affiliatePayout: number = 0) => {
  const pricing = computeFixedTierPricing({
    sellerPayout: sellerDesiredAmount,
    affiliatePayout,
    paypalPercent: PLATFORM_CONFIG.PROCESSING_FEE_PERCENTAGE / 100,
    paypalFixed: PLATFORM_CONFIG.PROCESSING_FEE_FIXED,
  });

  return {
    sellerAmount: pricing.sellerPayout,
    affiliateFee: pricing.affiliatePayout,
    platformFee: pricing.platformFee,
    processingFee: pricing.paypalProcessingAllowance,
    customerPays: pricing.finalAdvertisedPrice,
  };
};

export default PLATFORM_CONFIG;
