import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n🔍 SUPABASE CONNECTION TEST\n');
console.log('================================');

// Step 1: Check environment variables
console.log('\n✅ Step 1: Environment Variables');
console.log('Supabase URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
console.log('Supabase Anon Key:', supabaseAnonKey ? '✓ Set' : '✗ Missing');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\n❌ Missing required environment variables!');
  process.exit(1);
}

// Step 2: Create Supabase client
console.log('\n✅ Step 2: Creating Supabase Client');
const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('Client created successfully ✓');

// Step 3: Test connection by fetching health status
async function testConnection() {
  console.log('\n✅ Step 3: Testing Connection');
  
  try {
    // Try to query the profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection Error:', error.message);
      return false;
    }
    
    console.log('✓ Successfully connected to Supabase!');
    return true;
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return false;
  }
}

// Step 4: Test authentication
async function testAuth() {
  console.log('\n✅ Step 4: Testing Authentication System');
  
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Auth Error:', error.message);
      return false;
    }
    
    console.log('✓ Authentication system is accessible');
    console.log('Current session:', data.session ? 'Active' : 'None');
    return true;
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return false;
  }
}

// Step 5: Test database tables
async function testTables() {
  console.log('\n✅ Step 5: Testing Database Tables');
  
  const tables = [
    'profiles',
    'products',
    'categories',
    'affiliate_stores',
    'orders',
    'order_items'
  ];
  
  const results = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        results[table] = `❌ ${error.message}`;
      } else {
        results[table] = `✓ Accessible`;
      }
    } catch (err) {
      results[table] = `❌ ${err.message}`;
    }
  }
  
  for (const [table, status] of Object.entries(results)) {
    console.log(`  ${table}: ${status}`);
  }
  
  return results;
}

// Step 6: Test storage buckets
async function testStorage() {
  console.log('\n✅ Step 6: Testing Storage Buckets');
  
  try {
    const { data, error } = await supabase
      .storage
      .listBuckets();
    
    if (error) {
      console.error('❌ Storage Error:', error.message);
      return false;
    }
    
    console.log('✓ Storage system is accessible');
    console.log(`  Found ${data.length} bucket(s):`);
    data.forEach(bucket => {
      console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
    
    return true;
  } catch (err) {
    console.error('❌ Exception:', err.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  try {
    const connectionOk = await testConnection();
    const authOk = await testAuth();
    const tablesResults = await testTables();
    const storageOk = await testStorage();
    
    console.log('\n================================');
    console.log('📊 TEST SUMMARY');
    console.log('================================');
    console.log('Environment Variables:', '✓');
    console.log('Client Creation:', '✓');
    console.log('Connection:', connectionOk ? '✓' : '✗');
    console.log('Authentication:', authOk ? '✓' : '✗');
    console.log('Storage:', storageOk ? '✓' : '✗');
    
    const tableCount = Object.values(tablesResults).filter(r => r.includes('✓')).length;
    console.log(`Database Tables: ${tableCount}/6 accessible`);
    
    if (connectionOk && authOk) {
      console.log('\n✅ SUPABASE IS CONNECTED AND WORKING CORRECTLY!');
    } else {
      console.log('\n⚠️  SUPABASE CONNECTION HAS ISSUES - REVIEW ERRORS ABOVE');
    }
    
  } catch (err) {
    console.error('\n❌ Fatal Error:', err);
  }
}

runAllTests();
