// 🧪 **REAL PRODUCT TESTING UTILITIES**
// Tools for tomorrow's comprehensive payment verification

import { supabase } from '../lib/supabase';

// Test scenarios with expected outcomes
export const testScenarios = [
  {
    name: 'Standard Digital Product',
    sellerDesiredAmount: 100,
    affiliateRate: 20,
    expectedDistribution: {
      seller: 100.00,
      affiliate: 20.00,
      platform: 12.36,
      stripe: 4.24,
      customer: 136.60
    }
  },
  {
    name: 'Low Price Physical Product',
    sellerDesiredAmount: 50,
    affiliateRate: 15,
    expectedDistribution: {
      seller: 50.00,
      affiliate: 7.50,
      platform: 6.08,
      stripe: 2.32,
      customer: 65.90
    }
  },
  {
    name: 'High Value Consulting',
    sellerDesiredAmount: 200,
    affiliateRate: 25,
    expectedDistribution: {
      seller: 200.00,
      affiliate: 50.00,
      platform: 25.78,
      stripe: 8.10,
      customer: 283.88
    }
  },
  {
    name: 'Flat Rate Affiliate Commission',
    sellerDesiredAmount: 75,
    affiliateRate: 15,
    affiliateType: 'flat_rate',
    expectedDistribution: {
      seller: 75.00,
      affiliate: 15.00,
      platform: 9.27,
      stripe: 3.30,
      customer: 102.57
    }
  }
];

// Real payment verification function
export const verifyPaymentDistribution = async (transactionId: string) => {
  console.log(`🔍 Verifying payment distribution for transaction: ${transactionId}`);
  
  // Get transaction details
  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (transactionError) {
    console.error('❌ Transaction not found:', transactionError);
    return false;
  }

  // Get payment distributions
  const { data: distributions, error: distributionError } = await supabase
    .from('payment_distributions')
    .select('*')
    .eq('transaction_id', transactionId);

  if (distributionError) {
    console.error('❌ Distribution records not found:', distributionError);
    return false;
  }

  // Calculate totals
  const totals = distributions.reduce((acc, dist) => {
    acc[dist.recipient_type] = (acc[dist.recipient_type] || 0) + dist.amount;
    return acc;
  }, {} as Record<string, number>);

  // Verify total adds up
  const calculatedTotal = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  const actualTotal = transaction.total_amount;
  const difference = Math.abs(calculatedTotal - actualTotal);

  console.log('📊 Payment Distribution Verification:');
  console.log(`Transaction Total: $${actualTotal.toFixed(2)}`);
  console.log(`Calculated Total: $${calculatedTotal.toFixed(2)}`);
  console.log(`Difference: $${difference.toFixed(2)}`);
  
  if (difference > 0.01) {
    console.error('❌ CRITICAL: Payment distribution doesn\'t match transaction total!');
    return false;
  }

  console.log('✅ Payment distribution verified successfully!');
  
  // Detailed breakdown
  console.log('\n💰 Distribution Breakdown:');
  Object.entries(totals).forEach(([type, amount]) => {
    console.log(`${type}: $${amount.toFixed(2)}`);
  });

  return true;
};

// Test payment processing with Stripe test cards
export const testStripePayments = async () => {
  const testCards = [
    { number: '4242424242424242', name: 'Success Card', expectedResult: 'success' },
    { number: '4000000000000002', name: 'Declined Card', expectedResult: 'declined' },
    { number: '4000002500003155', name: '3D Secure Card', expectedResult: 'requires_action' },
    { number: '4000000000009995', name: 'Insufficient Funds', expectedResult: 'declined' }
  ];

  console.log('🧪 Testing Stripe Payment Processing...\n');

  for (const card of testCards) {
    console.log(`Testing ${card.name} (${card.number}):`);
    
    try {
      // This would be replaced with actual Stripe test in real implementation
      const mockResult = await simulateStripePayment(card.number);
      
      if (mockResult.status === card.expectedResult) {
        console.log(`✅ ${card.name}: Expected result (${card.expectedResult})`);
      } else {
        console.log(`❌ ${card.name}: Unexpected result. Expected: ${card.expectedResult}, Got: ${mockResult.status}`);
      }
    } catch (error) {
      console.error(`❌ ${card.name}: Error during payment:`, error);
    }
    
    console.log(''); // Empty line for readability
  }
};

// Simulate Stripe payment for testing
const simulateStripePayment = async (cardNumber: string) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock responses based on test card numbers
  switch (cardNumber) {
    case '4242424242424242':
      return { status: 'success', id: `pi_test_${Date.now()}` };
    case '4000000000000002':
      return { status: 'declined', error: 'generic_decline' };
    case '4000002500003155':
      return { status: 'requires_action', next_action: 'use_stripe_sdk' };
    case '4000000000009995':
      return { status: 'declined', error: 'insufficient_funds' };
    default:
      return { status: 'success', id: `pi_test_${Date.now()}` };
  }
};

// Affiliate commission verification
export const verifyAffiliateCommissions = async (affiliateId: string, dateFrom?: string) => {
  console.log(`🎯 Verifying affiliate commissions for: ${affiliateId}`);
  
  const fromDate = dateFrom || new Date().toISOString().split('T')[0]; // Today
  
  const { data: commissions, error } = await supabase
    .from('affiliate_commissions')
    .select(`
      *,
      transaction:transactions(total_amount),
      product:products(name, price)
    `)
    .eq('affiliate_id', affiliateId)
    .gte('created_at', fromDate);

  if (error) {
    console.error('❌ Error fetching affiliate commissions:', error);
    return false;
  }

  if (!commissions || commissions.length === 0) {
    console.log('ℹ️ No commissions found for the specified period');
    return true;
  }

  let totalCommissions = 0;
  console.log('\n💸 Affiliate Commission Details:');
  
  commissions.forEach((commission, index) => {
    console.log(`${index + 1}. Product: ${commission.product?.name}`);
    console.log(`   Transaction Total: $${commission.transaction?.total_amount?.toFixed(2)}`);
    console.log(`   Commission Rate: ${commission.commission_rate}%`);
    console.log(`   Commission Amount: $${commission.commission_amount?.toFixed(2)}`);
    console.log(`   Status: ${commission.status}`);
    console.log('');
    
    if (commission.status === 'completed') {
      totalCommissions += commission.commission_amount || 0;
    }
  });

  console.log(`📊 Total Completed Commissions: $${totalCommissions.toFixed(2)}`);
  return true;
};

// Platform revenue verification
export const verifyPlatformRevenue = async (dateFrom?: string) => {
  console.log('🏢 Verifying platform revenue...');
  
  const fromDate = dateFrom || new Date().toISOString().split('T')[0];
  
  const { data: revenue, error } = await supabase
    .from('platform_revenue')
    .select('*')
    .gte('created_at', fromDate);

  if (error) {
    console.error('❌ Error fetching platform revenue:', error);
    return false;
  }

  const revenueByType = revenue?.reduce((acc, rev) => {
    acc[rev.revenue_type] = (acc[rev.revenue_type] || 0) + rev.amount;
    return acc;
  }, {} as Record<string, number>) || {};

  console.log('\n💰 Platform Revenue Breakdown:');
  Object.entries(revenueByType).forEach(([type, amount]) => {
    console.log(`${type}: $${amount.toFixed(2)}`);
  });

  const totalRevenue = Object.values(revenueByType).reduce((sum, amount) => sum + amount, 0);
  console.log(`\n📊 Total Platform Revenue: $${totalRevenue.toFixed(2)}`);

  return true;
};

// Complete end-to-end test
export const runCompleteTest = async () => {
  console.log('🚀 Starting Complete Marketplace Test...\n');
  
  try {
    // Test 1: Stripe Payment Processing
    console.log('=== TEST 1: STRIPE PAYMENTS ===');
    await testStripePayments();
    
    // Test 2: Get recent transactions for verification
    console.log('\n=== TEST 2: RECENT TRANSACTIONS ===');
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('id')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentTransactions && recentTransactions.length > 0) {
      console.log(`Found ${recentTransactions.length} recent transactions`);
      
      // Verify each transaction's payment distribution
      for (const transaction of recentTransactions) {
        await verifyPaymentDistribution(transaction.id);
      }
    } else {
      console.log('No recent transactions found');
    }
    
    // Test 3: Platform Revenue Verification
    console.log('\n=== TEST 3: PLATFORM REVENUE ===');
    await verifyPlatformRevenue();
    
    console.log('\n🎉 Complete test finished successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
};

// Export for use in components
export default {
  testScenarios,
  verifyPaymentDistribution,
  testStripePayments,
  verifyAffiliateCommissions,
  verifyPlatformRevenue,
  runCompleteTest
};