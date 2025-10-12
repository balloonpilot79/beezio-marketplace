import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 QUICK EDGE FUNCTION TEST');
console.log('===========================\n');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function quickTest() {
  console.log('Testing create-payment-intent function...\n');
  
  try {
    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
      body: {
        amount: 1000,
        items: [{
          productId: 'test-123',
          title: 'Test Product',
          price: 10.00,
          quantity: 1,
          sellerId: 'test-seller',
          commissionRate: 70
        }],
        userId: 'test-user',
        billingName: 'Test User',
        billingEmail: 'test@example.com'
      }
    });
    
    if (error) {
      console.log('❌ Function Error:', error.message);
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Make sure you added STRIPE_SECRET_KEY in Supabase dashboard');
      console.log('2. Make sure you added STRIPE_WEBHOOK_SECRET in Supabase dashboard');
      console.log('3. Make sure you redeployed all functions after adding variables');
      console.log('\n📍 Go to: https://supabase.com/dashboard/project/yemgssttxhkgrivuodbz/settings/functions');
    } else {
      console.log('✅ SUCCESS! Function is working!');
      console.log('📋 Response:', data);
      console.log('\n🎉 Your Edge Functions are now operational!');
    }
    
  } catch (err) {
    console.log('❌ Test failed:', err.message);
  }
}

quickTest();