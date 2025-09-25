import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestUserAndProduct() {
  console.log('🧪 Creating a test user and product for real data testing...\n');

  // Generate a unique email for testing
  const testEmail = `testuser${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  console.log(`📧 Test email: ${testEmail}`);
  console.log(`🔑 Test password: ${testPassword}\n`);

  try {
    // Sign up the user
    console.log('1. Signing up test user...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    if (authError) {
      console.error('❌ Signup failed:', authError.message);
      return;
    }

    console.log('✅ User signed up successfully!');
    const userId = authData.user?.id;

    if (!userId) {
      console.error('❌ No user ID returned');
      return;
    }

    // Manually create profile since trigger may not be set up
    console.log('2. Creating profile...');
    const { error: profileInsertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: testEmail,
        full_name: 'Test User',
        role: 'seller'
      });

    if (profileInsertError) {
      console.error('❌ Profile creation failed:', profileInsertError.message);
      return;
    }

    console.log('✅ Profile created successfully!');

    // Fetch the profile to confirm
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch failed:', profileError.message);
      return;
    }

    console.log('✅ Profile verified:', profile);

    // Create a test product
    console.log('3. Creating a test product...');
    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        seller_id: userId,
        title: 'Test Product - Ready for Affiliates',
        description: 'This is a real test product created for affiliate selling. You can edit or delete it.',
        price: 29.99,
        category_id: null, // Will set later or leave null
        images: ['https://via.placeholder.com/300x200?text=Test+Product'],
        is_active: true,
        stock_quantity: 100,
        commission_rate: 10,
        commission_type: 'percentage',
        flat_commission_amount: 0,
        shipping_cost: 5.99,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (productError) {
      console.error('❌ Product creation failed:', productError.message);
      return;
    }

    console.log('✅ Product created:', product);

    console.log('\n🎉 Test user and product created successfully!');
    console.log('\n📋 Test Account Details:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Product ID: ${product.id}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Open http://localhost:5174/ in your browser');
    console.log('   2. Click "Login" and use the test email/password above');
    console.log('   3. Navigate to seller dashboard to see your product');
    console.log('   4. Try adding more real products or inviting affiliates');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

createTestUserAndProduct();