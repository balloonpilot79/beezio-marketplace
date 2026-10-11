// 🔍 **ADVANCED DATABASE DIAGNOSTICS**
// Detailed database connection and schema testing

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Test specific database issues
export const runDatabaseDiagnostics = async () => {
  console.log('🔍 ADVANCED DATABASE DIAGNOSTICS');
  console.log('================================\n');
  
  // Step 1: Check environment configuration
  console.log('📋 STEP 1: Environment Configuration');
  console.log(`   Supabase URL: ${import.meta.env.VITE_SUPABASE_URL || 'NOT SET'}`);
  console.log(`   Anonymous Key: ${import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}`);
  console.log(`   Is Configured: ${isSupabaseConfigured}`);
  
  if (!isSupabaseConfigured) {
    console.log('❌ Supabase is not configured properly');
    return false;
  }
  
  // Step 2: Test basic connection
  console.log('\n📋 STEP 2: Basic Connection Test');
  try {
    // Try the simplest possible query - check database version
    const { data, error } = await supabase.rpc('version');
    
    if (error) {
      console.log(`⚠️ RPC call failed: ${error.message}`);
      // Try alternative basic test
      console.log('   Trying alternative connection test...');
      
      const { data: authData, error: authError } = await supabase.auth.getSession();
      if (authError) {
        console.log(`❌ Auth test failed: ${authError.message}`);
      } else {
        console.log('✅ Auth connection working');
      }
    } else {
      console.log('✅ Database connection successful');
      console.log(`   Database version info available`);
    }
  } catch (error) {
    console.log(`❌ Connection test failed: ${error.message}`);
  }
  
  // Step 3: Test table access with detailed error reporting
  console.log('\n📋 STEP 3: Table Access Tests');
  
  const tables = [
    'profiles',
    'products', 
    'orders',
    'transactions',
    'payment_distributions',
    'affiliate_commissions',
    'platform_revenue'
  ];
  
  for (const tableName of tables) {
    try {
      console.log(`\n🔍 Testing table: ${tableName}`);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        console.log(`   ❌ Code: ${error.code}`);
        console.log(`   ❌ Details: ${error.details}`);
        
        // Specific error analysis
        if (error.code === '42P01') {
          console.log('   💡 Table does not exist - needs to be created');
        } else if (error.code === '42501') {
          console.log('   💡 Permission denied - RLS policy issue');
        } else if (error.message.includes('JWT')) {
          console.log('   💡 Authentication issue - check API keys');
        } else if (error.message.includes('permission')) {
          console.log('   💡 RLS (Row Level Security) is blocking access');
        }
      } else {
        console.log(`   ✅ Table exists and accessible`);
        console.log(`   📊 Count: ${data || 'Unknown'}`);
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
    }
  }
  
  // Step 4: Test authentication status
  console.log('\n📋 STEP 4: Authentication Status');
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log(`❌ Auth error: ${error.message}`);
    } else if (session) {
      console.log('✅ User is authenticated');
      console.log(`   User ID: ${session.user.id}`);
      console.log(`   Email: ${session.user.email || 'No email'}`);
    } else {
      console.log('ℹ️ No active session (anonymous user)');
      console.log('   This may explain RLS policy failures');
    }
  } catch (error) {
    console.log(`❌ Auth check failed: ${error.message}`);
  }
  
  // Step 5: Test specific RLS scenario
  console.log('\n📋 STEP 5: RLS Policy Test');
  try {
    // Try to access profiles table with different approaches
    console.log('   Testing profiles table access patterns...');
    
    // Test 1: Count query (should work with most RLS policies)
    const { data: countData, error: countError } = await supabase
      .from('profile_directory')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log(`   ❌ Count query failed: ${countError.message}`);
      
      // Suggest RLS fix
      console.log('\n💡 SUGGESTED FIX:');
      console.log('   Run this SQL in Supabase to temporarily disable RLS:');
      console.log('   ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;');
    } else {
      console.log('   ✅ Count query successful');
    }
    
  } catch (error) {
    console.log(`   ❌ RLS test failed: ${error.message}`);
  }
  
  // Summary and recommendations
  console.log('\n📋 DIAGNOSTIC SUMMARY');
  console.log('====================');
  
  console.log('\n🔧 IMMEDIATE ACTIONS:');
  console.log('1. Check if tables exist in Supabase dashboard');
  console.log('2. If tables exist, disable RLS temporarily for testing');
  console.log('3. If tables don\'t exist, run the database setup SQL');
  console.log('4. Verify environment variables are deployed correctly');
  
  console.log('\n📝 SQL TO RUN IN SUPABASE (if needed):');
  console.log('-- Temporarily disable RLS for testing');
  console.log('ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;');
  console.log('ALTER TABLE products DISABLE ROW LEVEL SECURITY;');
  
  return true;
};

export default {
  runDatabaseDiagnostics
};