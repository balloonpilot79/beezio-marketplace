#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

console.log('🔧 Environment Variables Validation');
console.log('====================================');

// Check all required environment variables
const requiredVars = {
  'VITE_SUPABASE_URL': process.env.VITE_SUPABASE_URL,
  'VITE_SUPABASE_ANON_KEY': process.env.VITE_SUPABASE_ANON_KEY,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'VITE_STRIPE_PUBLISHABLE_KEY': process.env.VITE_STRIPE_PUBLISHABLE_KEY,
  'STRIPE_SECRET_KEY': process.env.STRIPE_SECRET_KEY,
  'STRIPE_WEBHOOK_SECRET': process.env.STRIPE_WEBHOOK_SECRET
};

console.log('📋 Environment Variables Status:');
let allPresent = true;
for (const [key, value] of Object.entries(requiredVars)) {
  const status = value ? '✅' : '❌';
  const display = value ? `${value.substring(0, 20)}...` : 'Missing';
  console.log(`  ${status} ${key}: ${display}`);
  if (!value) allPresent = false;
}

if (!allPresent) {
  console.log('\n❌ Some environment variables are missing!');
  process.exit(1);
}

// Test Supabase connection
console.log('\n🔌 Testing Supabase Connection...');
try {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase.from('profiles').select('id').limit(1);
  
  if (error && error.code === '42P01') {
    console.log('⚠️  Database connected but tables not found');
    console.log('   This means database setup is needed');
  } else if (error) {
    console.log('❌ Connection error:', error.message);
  } else {
    console.log('✅ Supabase connection successful!');
    console.log(`   Found database with ${data?.length || 0} sample records`);
  }
} catch (err) {
  console.log('❌ Supabase test failed:', err.message);
}

// Test Stripe key format
console.log('\n💳 Validating Stripe Configuration...');
const stripePublishable = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripeSecret = process.env.STRIPE_SECRET_KEY;

if (stripePublishable?.startsWith('pk_test_')) {
  console.log('✅ Stripe publishable key format: TEST mode');
} else if (stripePublishable?.startsWith('pk_live_')) {
  console.log('✅ Stripe publishable key format: LIVE mode');
} else {
  console.log('❌ Invalid Stripe publishable key format');
}

if (stripeSecret?.startsWith('sk_test_')) {
  console.log('✅ Stripe secret key format: TEST mode');
} else if (stripeSecret?.startsWith('sk_live_')) {
  console.log('✅ Stripe secret key format: LIVE mode');
} else {
  console.log('❌ Invalid Stripe secret key format');
}

console.log('\n🎉 Environment validation complete!');
