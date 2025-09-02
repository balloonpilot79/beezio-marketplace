import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

async function testConnections() {
  console.log('🔍 Testing connections...\n');

  // Test Supabase
  console.log('Testing Supabase...');
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    
    if (error) {
      console.log('Supabase error:', error.message);
      if (error.code === '42P01') {
        console.log('✅ Supabase connected (tables need to be created)');
      }
    } else {
      console.log('✅ Supabase connected and tables exist');
    }
  } catch (err) {
    console.log('❌ Supabase failed:', err.message);
  }

  // Test Stripe
  console.log('\nTesting Stripe...');
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const account = await stripe.accounts.retrieve();
    console.log('✅ Stripe connected');
    console.log('Account ID:', account.id);
  } catch (err) {
    console.log('❌ Stripe failed:', err.message);
  }

  console.log('\n🎉 Connection test complete!');
}

testConnections().catch(console.error);
