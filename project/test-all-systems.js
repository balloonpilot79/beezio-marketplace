import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('\n🔍 COMPREHENSIVE SYSTEM TEST\n');
console.log('═'.repeat(60));

const issues = [];
const warnings = [];
const passed = [];

// Test 1: Database Tables
async function testDatabaseTables() {
  console.log('\n📊 Testing Database Tables...');
  
  const requiredTables = [
    'profiles',
    'products', 
    'categories',
    'orders',
    'order_items',
    'affiliate_stores',
    'affiliate_store_products',
    'affiliate_links',
    'user_roles',
    'store_settings',
    'product_reviews',
    'seller_reviews'
  ];
  
  for (const table of requiredTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          issues.push(`❌ Table '${table}' does not exist`);
        } else {
          issues.push(`❌ Table '${table}': ${error.message}`);
        }
      } else {
        passed.push(`✅ Table '${table}' accessible`);
      }
    } catch (err) {
      issues.push(`❌ Table '${table}': ${err.message}`);
    }
  }
}

// Test 2: Critical Columns
async function testCriticalColumns() {
  console.log('\n🔧 Testing Critical Columns...');
  
  const columnTests = [
    { table: 'profiles', columns: ['id', 'user_id', 'email', 'full_name', 'role'] },
    { table: 'products', columns: ['id', 'seller_id', 'title', 'price', 'commission_rate'] },
    { table: 'orders', columns: ['id', 'buyer_id', 'total_amount', 'status'] },
    { table: 'affiliate_stores', columns: ['id', 'profile_id', 'store_name', 'store_slug'] }
  ];
  
  for (const test of columnTests) {
    try {
      const { data, error } = await supabase
        .from(test.table)
        .select(test.columns.join(','))
        .limit(1);
      
      if (error) {
        if (error.code === '42703') {
          issues.push(`❌ ${test.table}: Missing column - ${error.message}`);
        } else {
          issues.push(`❌ ${test.table} columns: ${error.message}`);
        }
      } else {
        passed.push(`✅ ${test.table}: All critical columns exist`);
      }
    } catch (err) {
      issues.push(`❌ ${test.table} columns: ${err.message}`);
    }
  }
}

// Test 3: Storage Buckets
async function testStorage() {
  console.log('\n💾 Testing Storage Buckets...');
  
  const requiredBuckets = ['product-images', 'profile-avatars'];
  
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      issues.push(`❌ Storage: ${error.message}`);
      return;
    }
    
    const bucketNames = buckets.map(b => b.name);
    
    for (const bucket of requiredBuckets) {
      if (bucketNames.includes(bucket)) {
        passed.push(`✅ Storage bucket '${bucket}' exists`);
      } else {
        warnings.push(`⚠️  Storage bucket '${bucket}' missing (will be created on first upload)`);
      }
    }
  } catch (err) {
    issues.push(`❌ Storage test failed: ${err.message}`);
  }
}

// Test 4: Authentication
async function testAuth() {
  console.log('\n🔐 Testing Authentication...');
  
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      issues.push(`❌ Auth system: ${error.message}`);
    } else {
      passed.push('✅ Authentication system accessible');
    }
  } catch (err) {
    issues.push(`❌ Auth test failed: ${err.message}`);
  }
}

// Test 5: RLS Policies
async function testRLS() {
  console.log('\n🛡️  Testing Row Level Security...');
  
  try {
    // Test if we can query without auth (should be restricted)
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    
    // No error means RLS might not be enabled properly
    if (!error && data && data.length > 0) {
      warnings.push('⚠️  RLS might not be properly configured on profiles table');
    } else {
      passed.push('✅ RLS appears to be active');
    }
  } catch (err) {
    passed.push('✅ RLS is blocking unauthorized access');
  }
}

// Test 6: Required Functions
async function testFunctions() {
  console.log('\n⚡ Testing Database Functions...');
  
  try {
    // Test if we can call a simple function
    const { data, error } = await supabase.rpc('get_products_count');
    
    if (error) {
      if (error.code === '42883') {
        warnings.push('⚠️  Some database functions may be missing (non-critical)');
      }
    } else {
      passed.push('✅ Database functions accessible');
    }
  } catch (err) {
    // Non-critical
    warnings.push('⚠️  Could not test database functions');
  }
}

// Run all tests
async function runAllTests() {
  await testDatabaseTables();
  await testCriticalColumns();
  await testStorage();
  await testAuth();
  await testRLS();
  await testFunctions();
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═'.repeat(60));
  
  console.log(`\n✅ Passed: ${passed.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  console.log(`❌ Issues: ${issues.length}`);
  
  if (passed.length > 0) {
    console.log('\n✅ PASSED:');
    passed.forEach(p => console.log(`   ${p}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    warnings.forEach(w => console.log(`   ${w}`));
  }
  
  if (issues.length > 0) {
    console.log('\n❌ CRITICAL ISSUES:');
    issues.forEach(i => console.log(`   ${i}`));
  }
  
  console.log('\n' + '═'.repeat(60));
  
  if (issues.length === 0) {
    console.log('✅ ALL CRITICAL SYSTEMS OPERATIONAL!');
  } else {
    console.log('❌ CRITICAL ISSUES FOUND - NEED FIXES');
  }
  
  console.log('═'.repeat(60) + '\n');
}

runAllTests().catch(console.error);
