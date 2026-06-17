import { computeBeezioPlatformFee } from '../../shared/beezioFee';

// Platform fee configuration
// This file contains the fee structure for Beezio platform

export const PLATFORM_CONFIG = {
  // Platform fees (Beezio's revenue)
  PLATFORM_FEE_PERCENTAGE: 15,
  
  // Payment processing
  PROCESSING_FEE_PERCENTAGE: 3.99, // 3.99% + $0.60 per transaction/item
  PROCESSING_FEE_FIXED: 0.60, // $0.60 fixed fee
  
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
// UPDATED FORMULA: Platform fee is based on seller ask only.
// Processing is paid by the buyer and does not affect platform fee.
export const calculateFees = (sellerDesiredAmount: number, affiliateCommissionRate: number = 0) => {
  // Affiliate commission based on seller's desired amount
  const affiliateFee = sellerDesiredAmount * affiliateCommissionRate / 100;

  const base = sellerDesiredAmount + affiliateFee;
  const platformFee = computeBeezioPlatformFee(sellerDesiredAmount);

  // Processing fee: calculated on the final price (buyer pays it)
  const targetNet = base + platformFee;
  const processingRate = PLATFORM_CONFIG.PROCESSING_FEE_PERCENTAGE / 100;
  const customerPays = (targetNet + PLATFORM_CONFIG.PROCESSING_FEE_FIXED) / (1 - processingRate);
  const processingFee = customerPays - targetNet;

  return {
    sellerAmount: Number(sellerDesiredAmount.toFixed(2)), // Seller gets exactly what they want
    affiliateFee: Number(affiliateFee.toFixed(2)),
    platformFee: Number(platformFee.toFixed(2)),
    processingFee: Number(processingFee.toFixed(2)), // 3.99% + $0.60
    customerPays: Number(customerPays.toFixed(2))
  };
};

export default PLATFORM_CONFIG;
