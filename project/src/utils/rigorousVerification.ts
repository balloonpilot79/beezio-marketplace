// 🔍 **RIGOROUS TEST VERIFICATION SYSTEM**
// This system provides detailed proof that tests actually ran correctly

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Test verification with detailed logging and proof
export const verifyTestExecution = async () => {
  console.log('🔍 RIGOROUS TEST VERIFICATION');
  console.log('============================\n');
  
  const testResults = {
    timestamp: new Date().toISOString(),
    environment: window.location.hostname,
    supabaseConfig: false,
    databaseConnection: false,
    tableAccess: false,
    actualDataRead: false,
    writeTest: false,
    errors: [],
    details: {}
  };
  
  // Test 1: Environment Configuration with Proof
  console.log('📋 TEST 1: Environment Configuration Verification');
  console.log('================================================');
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log(`Environment: ${testResults.environment}`);
  console.log(`Timestamp: ${testResults.timestamp}`);
  console.log(`Supabase URL: ${supabaseUrl || 'UNDEFINED'}`);
  console.log(`Supabase Key Length: ${supabaseKey?.length || 0} characters`);
  console.log(`Is Configured: ${isSupabaseConfigured}`);
  
  testResults.supabaseConfig = isSupabaseConfigured;
  testResults.details.supabaseUrl = supabaseUrl;
  testResults.details.keyLength = supabaseKey?.length || 0;
  
  if (!isSupabaseConfigured) {
    testResults.errors.push('Supabase not configured - environment variables missing');
    console.log('❌ FAILED: Environment not configured');
    return testResults;
  }
  
  console.log('✅ PASSED: Environment configured');
  
  // Test 2: Actual Database Connection with Response Details
  console.log('\n📋 TEST 2: Database Connection Verification');
  console.log('===========================================');
  
  try {
    const startTime = Date.now();
    
    // Try to get the database timestamp - this proves we're actually connected
    const { data, error } = await supabase.rpc('now');
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`Response time: ${responseTime}ms`);
    
    if (error) {
      console.log(`❌ FAILED: Database connection error`);
      console.log(`Error code: ${error.code}`);
      console.log(`Error message: ${error.message}`);
      console.log(`Error details: ${error.details}`);
      
      testResults.errors.push(`Database connection failed: ${error.message}`);
      testResults.details.connectionError = error;
    } else {
      console.log(`✅ PASSED: Database connected successfully`);
      console.log(`Database timestamp: ${data}`);
      
      testResults.databaseConnection = true;
      testResults.details.databaseTimestamp = data;
      testResults.details.responseTime = responseTime;
    }
  } catch (error) {
    console.log(`❌ FAILED: Connection exception - ${error.message}`);
    testResults.errors.push(`Connection exception: ${error.message}`);
  }
  
  // Test 3: Table Access with Specific Queries
  console.log('\n📋 TEST 3: Table Access Verification');
  console.log('====================================');
  
  const tables = ['profiles', 'products', 'orders'];
  const tableResults = {};
  
  for (const tableName of tables) {
    console.log(`\nTesting table: ${tableName}`);
    
    try {
      const startTime = Date.now();
      
      // Try different types of queries to verify access
      const queries = [
        { name: 'count', query: supabase.from(tableName).select('*', { count: 'exact', head: true }) },
        { name: 'structure', query: supabase.from(tableName).select('*').limit(0) }
      ];
      
      const tableResult = {
        exists: false,
        accessible: false,
        queryResults: [],
        errors: []
      };
      
      for (const queryTest of queries) {
        try {
          const { data, error, count } = await queryTest.query;
          const endTime = Date.now();
          
          console.log(`  ${queryTest.name} query: ${endTime - startTime}ms`);
          
          if (error) {
            console.log(`  ❌ ${queryTest.name} failed: ${error.message} (${error.code})`);
            tableResult.errors.push(`${queryTest.name}: ${error.message}`);
            
            if (error.code === '42P01') {
              console.log(`  💡 Table '${tableName}' does not exist`);
            } else if (error.code === '42501') {
              console.log(`  💡 Permission denied - RLS policy blocking access`);
              tableResult.exists = true; // Table exists but RLS is blocking
            }
          } else {
            console.log(`  ✅ ${queryTest.name} successful`);
            if (queryTest.name === 'count') {
              console.log(`  📊 Record count: ${count !== null ? count : 'Unknown'}`);
            }
            tableResult.accessible = true;
            tableResult.exists = true;
          }
          
          tableResult.queryResults.push({
            type: queryTest.name,
            success: !error,
            data: data,
            count: count,
            error: error?.message
          });
          
        } catch (queryError) {
          console.log(`  ❌ ${queryTest.name} exception: ${queryError.message}`);
          tableResult.errors.push(`${queryTest.name} exception: ${queryError.message}`);
        }
      }
      
      tableResults[tableName] = tableResult;
      
      if (tableResult.accessible) {
        console.log(`  ✅ Table '${tableName}' is accessible`);
      } else if (tableResult.exists) {
        console.log(`  ⚠️ Table '${tableName}' exists but not accessible (RLS issue)`);
      } else {
        console.log(`  ❌ Table '${tableName}' does not exist`);
      }
      
    } catch (error) {
      console.log(`  ❌ Exception testing '${tableName}': ${error.message}`);
      tableResults[tableName] = {
        exists: false,
        accessible: false,
        errors: [error.message]
      };
    }
  }
  
  testResults.details.tables = tableResults;
  testResults.tableAccess = Object.values(tableResults).some(t => t.accessible);
  
  // Test 4: Authentication Status Check
  console.log('\n📋 TEST 4: Authentication Status');
  console.log('=================================');
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log(`❌ Auth check failed: ${error.message}`);
      testResults.errors.push(`Auth error: ${error.message}`);
    } else if (session) {
      console.log(`✅ User authenticated: ${session.user.email}`);
      console.log(`User ID: ${session.user.id}`);
      testResults.details.authenticated = true;
      testResults.details.userId = session.user.id;
      testResults.details.userEmail = session.user.email;
    } else {
      console.log(`ℹ️ Anonymous user (no session)`);
      testResults.details.authenticated = false;
    }
  } catch (error) {
    console.log(`❌ Auth exception: ${error.message}`);
    testResults.errors.push(`Auth exception: ${error.message}`);
  }
  
  // Final Verification Summary
  console.log('\n📋 FINAL VERIFICATION SUMMARY');
  console.log('=============================');
  
  const score = [
    testResults.supabaseConfig,
    testResults.databaseConnection,
    testResults.tableAccess
  ].filter(Boolean).length;
  
  console.log(`Test Score: ${score}/3`);
  console.log(`Environment Config: ${testResults.supabaseConfig ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Database Connection: ${testResults.databaseConnection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Table Access: ${testResults.tableAccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🚨 ERRORS FOUND:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  // Specific Recommendations
  console.log('\n🔧 SPECIFIC NEXT ACTIONS:');
  
  if (!testResults.supabaseConfig) {
    console.log('1. ❌ Fix environment variables in Netlify');
  } else if (!testResults.databaseConnection) {
    console.log('1. ❌ Check Supabase project status and API keys');
  } else if (!testResults.tableAccess) {
    console.log('1. ❌ Create missing tables or fix RLS policies');
    console.log('2. 💡 Run database setup SQL in Supabase dashboard');
  } else {
    console.log('1. ✅ Database is fully functional!');
  }
  
  console.log('\n📊 RAW TEST DATA:');
  console.log(JSON.stringify(testResults, null, 2));
  
  return testResults;
};

// Quick verification that shows actual proof
export const quickProofTest = async () => {
  console.log('⚡ QUICK PROOF TEST');
  console.log('==================\n');
  
  // Show current time to prove test is running
  const now = new Date();
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Browser: ${navigator.userAgent.substring(0, 50)}...`);
  console.log(`URL: ${window.location.href}`);
  
  // Test actual environment variables
  const hasUrl = !!import.meta.env.VITE_SUPABASE_URL;
  const hasKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  console.log(`\nEnvironment Variables:`);
  console.log(`VITE_SUPABASE_URL exists: ${hasUrl}`);
  console.log(`VITE_SUPABASE_ANON_KEY exists: ${hasKey}`);
  
  if (hasUrl && hasKey) {
    console.log('✅ Environment variables are present');
    
    // Try one real database call
    try {
      console.log('\nTesting actual database call...');
      const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      
      if (error) {
        console.log('❌ Database call failed:');
        console.log(`   Code: ${error.code}`);
        console.log(`   Message: ${error.message}`);
        console.log('💡 This proves the test is actually running and hitting the database');
        return false;
      } else {
        console.log('✅ Database call succeeded');
        console.log(`   Found ${data} records in profiles table`);
        console.log('🎉 This proves the database is working!');
        return true;
      }
    } catch (error) {
      console.log('❌ Exception during database test:');
      console.log(`   ${error.message}`);
      console.log('💡 This proves the test is actually running');
      return false;
    }
  } else {
    console.log('❌ Environment variables missing');
    console.log('💡 This proves the test is actually checking real configuration');
    return false;
  }
};

export default {
  verifyTestExecution,
  quickProofTest
};