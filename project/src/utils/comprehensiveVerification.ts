// 🧪 **QUICK DATABASE AND PAYMENT VERIFICATION**
// Run this to test your actual database structure and payment calculations

import { supabase } from '../lib/supabase';
import { calculatePricing } from '../lib/pricing';

// Test database connectivity
export const testDatabaseConnection = async () => {
  console.log('🔌 Testing database connection...');
  
  try {
    // First check if supabase is configured
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return false;
    }
    
    console.log('🔍 Supabase client initialized, testing connection...');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('count()', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('Error details:', error);
      return false;
    }
    
    console.log('✅ Database connected successfully');
    console.log(`📊 Found ${data} user profiles`);
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    return false;
  }
};

// Test payment calculation accuracy
export const testPaymentCalculations = () => {
  console.log('🧮 Testing payment calculations...');
  
  try {
    // First check if calculatePricing function is available
    if (!calculatePricing) {
      console.error('❌ calculatePricing function not available');
      return false;
    }
    
    console.log('🔍 Testing payment calculation function...');
    
    const testCases = [
      { seller: 100, affiliate: 20, expected: { customer: 136.60, platform: 12.36, stripe: 4.24 } },
      { seller: 50, affiliate: 15, expected: { customer: 65.90, platform: 6.08, stripe: 2.32 } },
      { seller: 200, affiliate: 25, expected: { customer: 283.88, platform: 25.78, stripe: 8.10 } }
    ];
    
    let allPassed = true;
    
    testCases.forEach((testCase, index) => {
      try {
        console.log(`\n📝 Test Case ${index + 1}:`);
        console.log(`Seller wants: $${testCase.seller}, Affiliate: ${testCase.affiliate}%`);
        
        const result = calculatePricing({
          sellerDesiredAmount: testCase.seller,
          affiliateRate: testCase.affiliate,
          affiliateType: 'percentage'
        });
        
        console.log(`🔍 Raw result:`, result);
        
        // Check if calculations match expectations (within 1 cent)
        const customerMatch = Math.abs(result.listingPrice - testCase.expected.customer) < 0.01;
        const platformMatch = Math.abs(result.platformFee - testCase.expected.platform) < 0.01;
        const stripeMatch = Math.abs(result.stripeFee - testCase.expected.stripe) < 0.01;
        
        if (customerMatch && platformMatch && stripeMatch) {
          console.log('✅ Calculations correct');
          console.log(`   Customer: $${result.listingPrice.toFixed(2)} ✓`);
          console.log(`   Platform: $${result.platformFee.toFixed(2)} ✓`);
          console.log(`   Stripe: $${result.stripeFee.toFixed(2)} ✓`);
        } else {
          allPassed = false;
          console.log('❌ Calculations incorrect');
          console.log(`   Customer: $${result.listingPrice.toFixed(2)} (expected $${testCase.expected.customer})`);
          console.log(`   Platform: $${result.platformFee.toFixed(2)} (expected $${testCase.expected.platform})`);
          console.log(`   Stripe: $${result.stripeFee.toFixed(2)} (expected $${testCase.expected.stripe})`);
        }
      } catch (error) {
        console.error(`❌ Error in test case ${index + 1}:`, error);
        allPassed = false;
      }
    });
    
    return allPassed;
  } catch (error) {
    console.error('❌ Payment calculations test failed:', error);
    return false;
  }
};

// Test recent transactions
export const testRecentTransactions = async () => {
  console.log('📊 Checking recent transactions...');
  
  try {
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        id,
        total_amount,
        status,
        created_at,
        payment_distributions(recipient_type, amount)
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.error('❌ Error fetching transactions:', error);
      return false;
    }
    
    if (!transactions || transactions.length === 0) {
      console.log('ℹ️ No recent transactions found');
      return true;
    }
    
    console.log(`📈 Found ${transactions.length} recent transactions:`);
    
    transactions.forEach((transaction, index) => {
      console.log(`\n${index + 1}. Transaction ${transaction.id.substring(0, 8)}`);
      console.log(`   Total: $${transaction.total_amount?.toFixed(2)}`);
      console.log(`   Status: ${transaction.status}`);
      console.log(`   Date: ${new Date(transaction.created_at).toLocaleDateString()}`);
      
      if (transaction.payment_distributions && transaction.payment_distributions.length > 0) {
        console.log('   Distributions:');
        transaction.payment_distributions.forEach((dist: any) => {
          console.log(`     ${dist.recipient_type}: $${dist.amount?.toFixed(2)}`);
        });
      }
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error checking transactions:', error);
    return false;
  }
};

// Test table structure
export const testTableStructure = async () => {
  console.log('🏗️ Verifying database table structure...');
  
  const requiredTables = [
    'profiles',
    'products', 
    'transactions',
    'payment_distributions',
    'affiliate_commissions',
    'platform_revenue'
  ];
  
  let allTablesExist = true;
  
  for (const table of requiredTables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);
      
      if (error) {
        console.log(`❌ Table '${table}' not accessible: ${error.message}`);
        allTablesExist = false;
      } else {
        console.log(`✅ Table '${table}' exists and accessible`);
      }
    } catch (error) {
      console.log(`❌ Error checking table '${table}':`, error);
      allTablesExist = false;
    }
  }
  
  return allTablesExist;
};

// Run comprehensive verification
export const runComprehensiveVerification = async () => {
  console.log('🚀 COMPREHENSIVE MARKETPLACE VERIFICATION');
  console.log('==========================================\n');
  
  const results = {
    database: false,
    calculations: false,
    tables: false,
    transactions: false
  };
  
  // Test 1: Database Connection
  console.log('🔍 STEP 1: Database Connection');
  results.database = await testDatabaseConnection();
  console.log('');
  
  // Test 2: Payment Calculations
  console.log('🔍 STEP 2: Payment Calculations');
  results.calculations = testPaymentCalculations();
  console.log('');
  
  // Test 3: Table Structure
  console.log('🔍 STEP 3: Table Structure');
  results.tables = await testTableStructure();
  console.log('');
  
  // Test 4: Recent Transactions
  console.log('🔍 STEP 4: Recent Transactions');
  results.transactions = await testRecentTransactions();
  console.log('');
  
  // Summary
  console.log('📋 VERIFICATION SUMMARY');
  console.log('======================');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  
  console.log(`\n🎯 OVERALL STATUS: ${allPassed ? 'READY FOR TESTING' : 'NEEDS ATTENTION'}`);
  
  if (allPassed) {
    console.log('\n🚀 Your marketplace is ready for real product testing!');
    console.log('Next steps:');
    console.log('1. Add real products through /seller/products/new');
    console.log('2. Set up affiliate accounts and test commission tracking');
    console.log('3. Process test payments using Stripe test cards');
    console.log('4. Verify payment distributions in real-time');
  } else {
    console.log('\n⚠️ Please address the failed tests before proceeding.');
  }
  
  return allPassed;
};

// Create some test data
export const createTestData = async () => {
  console.log('🎭 Creating test data for marketplace testing...');
  
  try {
    // This would create test products, users, etc.
    // For now, just a placeholder
    console.log('ℹ️ Test data creation would happen here');
    console.log('   - Test seller accounts');
    console.log('   - Test affiliate accounts');
    console.log('   - Sample products');
    console.log('   - Mock transactions');
    
    return true;
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    return false;
  }
};

export default {
  testDatabaseConnection,
  testPaymentCalculations,
  testRecentTransactions,
  testTableStructure,
  runComprehensiveVerification,
  createTestData
};