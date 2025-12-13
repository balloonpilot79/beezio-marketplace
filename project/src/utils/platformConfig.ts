// Platform fee configuration
// This file contains the fee structure for Beezio platform

export const PLATFORM_CONFIG = {
  // Platform fees (Beezio's revenue)
  PLATFORM_FEE_PERCENTAGE: 15, // 15% platform fee on all sales (UPDATED Oct 2025)
  
  // Payment processing
  STRIPE_FEE_PERCENTAGE: 2.9, // 2.9% + $0.60 per transaction (CORRECTED)
  STRIPE_FEE_FIXED: 0.60, // $0.60 fixed fee
  
  // Affiliate commissions (default rates)
  DEFAULT_AFFILIATE_COMMISSION: 20, // 20% default commission rate
  MAX_AFFILIATE_COMMISSION: 50, // Maximum 50% commission allowed
  
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
// UPDATED FORMULA: Seller + Affiliate + Stripe (2.9% + $0.60) + Beezio 15% fee
export const calculateFees = (sellerDesiredAmount: number, affiliateCommissionRate: number = 0) => {
  // Affiliate commission based on seller's desired amount
  const affiliateFee = sellerDesiredAmount * affiliateCommissionRate / 100;

  // Stripe fee: 2.9% of (seller + affiliate) + $0.60
  const stripeBase = sellerDesiredAmount + affiliateFee;
  const stripeFee = stripeBase * (PLATFORM_CONFIG.STRIPE_FEE_PERCENTAGE / 100) + PLATFORM_CONFIG.STRIPE_FEE_FIXED;

  // Platform fee: 15% of (seller + affiliate + stripe)
  const platformFee = (sellerDesiredAmount + affiliateFee + stripeFee) * (PLATFORM_CONFIG.PLATFORM_FEE_PERCENTAGE / 100);

  // Final price customer pays
  const customerPays = sellerDesiredAmount + affiliateFee + stripeFee + platformFee;

  return {
    sellerAmount: Number(sellerDesiredAmount.toFixed(2)), // Seller gets exactly what they want
    affiliateFee: Number(affiliateFee.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)), // This goes to Beezio (15%)
    stripeFee: Number(stripeFee.toFixed(2)), // 2.9% + $0.60
    customerPays: Number(customerPays.toFixed(2))
  };
};

export default PLATFORM_CONFIG;
