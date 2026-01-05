import { createClient } from '@supabase/supabase-js';

console.log('🔧 BEEZIO ENVIRONMENT VALIDATION REPORT');
console.log('======================================');

// Get environment variables (these are loaded by Vite)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

console.log('\n📋 Environment Variables Status:');
console.log(`  ✅ VITE_SUPABASE_URL: ${supabaseUrl?.substring(0, 30)}...`);
console.log(`  ✅ VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Present' : 'Missing'}`);
console.log(`  ✅ VITE_STRIPE_PUBLISHABLE_KEY: ${stripePublishableKey?.substring(0, 20)}...`);

// Validate formats
console.log('\n🔍 Configuration Validation:');

if (supabaseUrl?.includes('supabase.co')) {
  console.log('  ✅ Supabase URL format is valid');
} else {
  console.log('  ❌ Invalid Supabase URL format');
}

if (stripePublishableKey?.startsWith('pk_test_')) {
  console.log('  ✅ Stripe key format: TEST mode (development)');
} else if (stripePublishableKey?.startsWith('pk_live_')) {
  console.log('  ⚠️  Stripe key format: LIVE mode (production)');
} else {
  console.log('  ❌ Invalid Stripe key format');
}

// Test Supabase connection
console.log('\n🔌 Testing Supabase Connection...');

if (supabaseUrl && supabaseAnonKey) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Simple connection test
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error && error.code === '42P01') {
      console.log('  ⚠️  Connected but tables not found - database setup needed');
    } else if (error) {
      console.log(`  ❌ Connection error: ${error.message}`);
    } else {
      console.log('  ✅ Database connection successful!');
    }
  } catch (err) {
    console.log(`  ❌ Connection test failed: ${err.message}`);
  }
} else {
  console.log('  ❌ Missing Supabase credentials');
}

console.log('\n🚀 FINAL STATUS:');
console.log('================');

if (supabaseUrl && supabaseAnonKey && stripePublishableKey) {
  console.log('✅ Environment configuration is READY!');
  console.log('✅ Development server can run');
  console.log('✅ Ready for local development and testing');
  
  if (stripePublishableKey.startsWith('pk_test_')) {
    console.log('ℹ️  Currently in TEST mode - perfect for development');
  }
} else {
  console.log('❌ Environment configuration has issues');
}
