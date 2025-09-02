// Simple Payment Processing Simulation
// In a real app, this would be your backend API

import { calculatePricing, PricingInput } from '../lib/pricing';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  metadata: {
    orderId: string;
    affiliateId?: string;
    commission?: number;
  };
}

export interface PaymentDistribution {
  sellerAmount: number;
  affiliateAmount: number;
  platformFee: number;
  stripeFee: number;
  sellerPayout: number;
  affiliatePayout: number;
  platformRevenue: number;
}

export interface OrderProcessingResult {
  success: boolean;
  orderId: string;
  paymentIntentId: string;
  totalAmount: number;
  distribution: PaymentDistribution;
  error?: string;
}

// Calculate correct payment distribution using our pricing formula
const calculatePaymentDistribution = (
  items: any[],
  affiliateId?: string
): PaymentDistribution => {
  let totalSellerAmount = 0;
  let totalAffiliateAmount = 0;
  let totalPlatformFee = 0;
  let totalStripeFee = 0;

  // Process each item with correct fee structure
  for (const item of items) {
    const quantity = item.quantity || 1;
    
    // Get the base price (this should be the seller's desired amount per item)
    const sellerAmountPerItem = item.seller_desired_amount || (item.price * 0.75); // Fallback estimation
    const sellerTotalForItem = sellerAmountPerItem * quantity;
    
    // Calculate affiliate commission rate for this item
    const affiliateRate = affiliateId ? (item.commission_rate || 20) : 0;
    
    // Use our corrected pricing calculation
    const pricingInput: PricingInput = {
      sellerDesiredAmount: sellerTotalForItem,
      affiliateRate: affiliateRate,
      affiliateType: 'percentage'
    };
    
    const breakdown = calculatePricing(pricingInput);
    
    totalSellerAmount += breakdown.sellerAmount;
    totalAffiliateAmount += breakdown.affiliateAmount;
    totalPlatformFee += breakdown.platformFee;
    totalStripeFee += breakdown.stripeFee;
  }

  return {
    sellerAmount: totalSellerAmount,
    affiliateAmount: totalAffiliateAmount,
    platformFee: totalPlatformFee,
    stripeFee: totalStripeFee,
    sellerPayout: totalSellerAmount, // Seller gets exactly what they wanted
    affiliatePayout: totalAffiliateAmount,
    platformRevenue: totalPlatformFee
  };
};

// Simulate payment processing
export const processPayment = async (
  items: any[],
  customerInfo: any,
  paymentMethodId: string,
  affiliateId?: string
): Promise<OrderProcessingResult> => {
  
  // Calculate correct payment distribution
  const distribution = calculatePaymentDistribution(items, affiliateId);
  
  // Total amount customer pays
  const totalAmount = distribution.sellerAmount + 
                     distribution.affiliateAmount + 
                     distribution.platformFee + 
                     distribution.stripeFee;
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Simulate payment processing
  const orderId = `BZ-${Date.now()}`;
  const paymentIntentId = `pi_${Math.random().toString(36).substr(2, 24)}`;

  // In real implementation, this would:
  // 1. Create Stripe PaymentIntent with correct amount
  // 2. Store order in database with proper fee breakdown
  // 3. Update inventory
  // 4. Send confirmation emails
  // 5. Queue fulfillment tasks
  // 6. Record exact commission amounts for proper payouts
  
  console.log('🔄 Processing Payment with CORRECT Fee Structure:', {
    orderId,
    totalAmount: totalAmount.toFixed(2),
    breakdown: {
      seller: `$${distribution.sellerPayout.toFixed(2)} (gets exactly what they wanted)`,
      affiliate: `$${distribution.affiliatePayout.toFixed(2)} (commission)`,
      platform: `$${distribution.platformRevenue.toFixed(2)} (10% of seller amount)`,
      stripe: `$${distribution.stripeFee.toFixed(2)} (3% processing)`
    },
    itemCount: items.length,
    customer: customerInfo.email,
    affiliateId: affiliateId || 'none'
  });

  // Simulate 95% success rate
  const success = Math.random() > 0.05;

  if (success) {
    console.log('✅ Payment Successful with Correct Distribution:', {
      orderId,
      paymentIntentId,
      'Seller gets': `$${distribution.sellerPayout.toFixed(2)}`,
      'Affiliate gets': `$${distribution.affiliatePayout.toFixed(2)}`,
      'Platform gets': `$${distribution.platformRevenue.toFixed(2)}`,
      'Stripe gets': `$${distribution.stripeFee.toFixed(2)}`
    });

    return {
      success: true,
      orderId,
      paymentIntentId,
      totalAmount,
      distribution
    };
  } else {
    console.log('❌ Payment Failed (simulated failure)');
    
    return {
      success: false,
      orderId,
      paymentIntentId,
      totalAmount,
      distribution,
      error: 'Payment processing failed (simulated)'
    };
  }
};

// Helper function to validate item pricing
export const validateItemPricing = (item: any): boolean => {
  const sellerAmount = item.seller_desired_amount || 0;
  const affiliateRate = item.commission_rate || 0;
  
  if (sellerAmount <= 0) {
    console.warn(`Item ${item.id} missing seller_desired_amount`);
    return false;
  }
  
  if (affiliateRate < 0 || affiliateRate > 100) {
    console.warn(`Item ${item.id} has invalid affiliate rate: ${affiliateRate}%`);
    return false;
  }
  
  return true;
};

// Helper to create payment metadata for Stripe
export const createPaymentMetadata = (
  orderId: string,
  distribution: PaymentDistribution,
  affiliateId?: string
) => {
  return {
    orderId,
    sellerPayout: distribution.sellerPayout.toFixed(2),
    affiliatePayout: distribution.affiliatePayout.toFixed(2),
    platformRevenue: distribution.platformRevenue.toFixed(2),
    stripeFee: distribution.stripeFee.toFixed(2),
    affiliateId: affiliateId || '',
    feeStructure: 'seller_plus_10pct_plus_affiliate_plus_3pct'
  };
};

// Simulate getting commission rates for products
export const getCommissionRates = async (productIds: string[]) => {
  // In real app, this would fetch from database
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return productIds.reduce((acc, id) => {
    acc[id] = Math.floor(Math.random() * 40) + 15; // 15-55% commission
    return acc;
  }, {} as Record<string, number>);
};

// Simulate affiliate performance tracking
export const trackAffiliateClick = async (productId: string, affiliateId: string) => {
  console.log('📊 Tracking affiliate click:', { productId, affiliateId });
  
  // In real app, this would:
  // 1. Store click event in database
  // 2. Update affiliate stats
  // 3. Handle attribution
  // 4. Update analytics dashboards
  
  return true;
};

export const trackAffiliateSale = async (
  productId: string, 
  affiliateId: string, 
  saleAmount: number, 
  commission: number
) => {
  console.log('💰 Tracking affiliate sale:', { 
    productId, 
    affiliateId, 
    saleAmount, 
    commission 
  });
  
  // In real app, this would:
  // 1. Record sale attribution
  // 2. Update affiliate earnings
  // 3. Queue commission payments
  // 4. Update performance metrics
  // 5. Send affiliate notifications
  
  return true;
};

// Commission transparency - what buyers see
export const getCommissionBreakdown = (items: any[], affiliateId?: string) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  if (affiliateId) {
    const affiliateCommission = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity * (item.commission_rate || 25) / 100);
    }, 0);
    
    const platformFee = subtotal * 0.03;
    
    return {
      type: 'affiliate',
      affiliate: {
        commission: affiliateCommission,
        percentage: (affiliateCommission / subtotal * 100).toFixed(1)
      },
      platform: {
        fee: platformFee,
        percentage: '3.0'
      },
      transparency: `${affiliateCommission.toFixed(2)} goes to the affiliate who referred you, $${platformFee.toFixed(2)} covers platform operations.`
    };
  } else {
    const beezioCommission = items.reduce((sum, item) => {
      return sum + (item.price * item.quantity * (item.commission_rate || 25) / 100);
    }, 0);
    
    return {
      type: 'direct',
      platform: {
        commission: beezioCommission,
        percentage: (beezioCommission / subtotal * 100).toFixed(1)
      },
      transparency: `$${beezioCommission.toFixed(2)} supports platform operations, seller services, and marketplace development.`
    };
  }
};

export default {
  processPayment,
  getCommissionRates,
  trackAffiliateClick,
  trackAffiliateSale,
  getCommissionBreakdown
};
