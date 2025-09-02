// Script to populate the database with sample data
// Run this with: npm run populate-db

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need to add this to your .env

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Sample profiles data
const sampleProfiles = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    full_name: 'John Smith',
    role: 'seller',
    location: 'New York, NY'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    full_name: 'Jane Wilson', 
    role: 'affiliate',
    location: 'Los Angeles, CA'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    full_name: 'Mike\'s Local Store',
    role: 'seller',
    location: 'Chicago, IL'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    full_name: 'Sarah\'s Crafts',
    role: 'seller', 
    location: 'Austin, TX'
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    full_name: 'Tom\'s Tech Shop',
    role: 'seller',
    location: 'Seattle, WA'
  }
];

// Sample products data
const sampleProducts = [
  {
    title: 'Wireless Bluetooth Headphones',
    description: 'Premium quality wireless headphones with noise cancellation and 30-hour battery life. Perfect for music lovers and professionals.',
    price: 149.99,
    seller_amount: 115.49,
    platform_fee: 14.99,
    stripe_fee: 4.50,
    images: ['https://images.pexels.com/photos/3587478/pexels-photo-3587478.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 15.0,
    commission_type: 'percentage',
    flat_commission_amount: 0,
    seller_id: '550e8400-e29b-41d4-a716-446655440005',
    is_active: true,
    shipping_cost: 5.99,
    is_subscription: false,
    subscription_interval: null
  },
  {
    title: 'Smart Fitness Watch',
    description: 'Track your health and fitness with this advanced smartwatch. Heart rate monitor, GPS, and 7-day battery life.',
    price: 299.99,
    seller_amount: 230.99,
    platform_fee: 29.99,
    stripe_fee: 9.00,
    images: ['https://images.pexels.com/photos/393047/pexels-photo-393047.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 20.0,
    commission_type: 'percentage',
    flat_commission_amount: 0,
    seller_id: '550e8400-e29b-41d4-a716-446655440005',
    is_active: true,
    shipping_cost: 0,
    is_subscription: false,
    subscription_interval: null
  },
  {
    title: 'Handcrafted Leather Wallet',
    description: 'Genuine leather wallet handcrafted with precision. Multiple card slots and bill compartments. Perfect gift for professionals.',
    price: 89.99,
    seller_amount: 69.29,
    platform_fee: 8.99,
    stripe_fee: 2.70,
    images: ['https://images.pexels.com/photos/1240892/pexels-photo-1240892.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 12.0,
    commission_type: 'percentage',
    flat_commission_amount: 0,
    seller_id: '550e8400-e29b-41d4-a716-446655440004',
    is_active: true,
    shipping_cost: 3.99,
    is_subscription: false,
    subscription_interval: null
  },
  {
    title: 'Fresh Local Honey',
    description: 'Raw, unfiltered honey from local beehives. Pure and natural sweetness straight from our local farm.',
    price: 24.99,
    seller_amount: 19.24,
    platform_fee: 2.49,
    stripe_fee: 0.75,
    images: ['https://images.pexels.com/photos/1638459/pexels-photo-1638459.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 8.0,
    commission_type: 'percentage',
    flat_commission_amount: 0,
    seller_id: '550e8400-e29b-41d4-a716-446655440003',
    is_active: true,
    shipping_cost: 4.99,
    is_subscription: false,
    subscription_interval: null
  },
  {
    title: 'Monthly Coffee Subscription',
    description: 'Premium coffee beans delivered monthly. Curated selection from local roasters. Cancel anytime.',
    price: 29.99,
    seller_amount: 23.09,
    platform_fee: 2.99,
    stripe_fee: 0.90,
    images: ['https://images.pexels.com/photos/324028/pexels-photo-324028.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 10.0,
    commission_type: 'percentage',
    flat_commission_amount: 0,
    seller_id: '550e8400-e29b-41d4-a716-446655440003',
    is_active: true,
    shipping_cost: 0,
    is_subscription: true,
    subscription_interval: 'monthly'
  },
  {
    title: 'Digital Marketing Course',
    description: 'Complete digital marketing course with video lessons, templates, and lifetime access. Learn from industry experts.',
    price: 197.99,
    seller_amount: 152.45,
    platform_fee: 19.79,
    stripe_fee: 5.94,
    images: ['https://images.pexels.com/photos/265087/pexels-photo-265087.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 25.0,
    commission_type: 'percentage',
    flat_commission_amount: 0,
    seller_id: '550e8400-e29b-41d4-a716-446655440001',
    is_active: true,
    shipping_cost: 0,
    is_subscription: false,
    subscription_interval: null
  },
  {
    title: 'Vintage Style Sunglasses',
    description: 'Classic vintage-style sunglasses with UV protection. Unisex design suitable for all face shapes.',
    price: 79.99,
    seller_amount: 61.59,
    platform_fee: 7.99,
    stripe_fee: 2.40,
    images: ['https://images.pexels.com/photos/46710/pexels-photo-46710.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 0,
    commission_type: 'flat_rate',
    flat_commission_amount: 25.00,
    seller_id: '550e8400-e29b-41d4-a716-446655440004',
    is_active: true,
    shipping_cost: 4.99,
    is_subscription: false,
    subscription_interval: null
  },
  {
    title: 'Premium Business Consulting',
    description: 'One-on-one business consulting session with industry expert. 2-hour session includes follow-up report.',
    price: 499.99,
    seller_amount: 384.99,
    platform_fee: 49.99,
    stripe_fee: 15.00,
    images: ['https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg?auto=compress&cs=tinysrgb&w=500'],
    videos: [],
    commission_rate: 40.0,
    commission_type: 'percentage',
    flat_commission_amount: 0,
    seller_id: '550e8400-e29b-41d4-a716-446655440001',
    is_active: true,
    shipping_cost: 0,
    is_subscription: false,
    subscription_interval: null
  }
];

async function populateDatabase() {
  try {
    console.log('🌱 Starting to populate database with sample data...');

    // Insert sample profiles
    console.log('📝 Inserting sample profiles...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert(sampleProfiles, { onConflict: 'id' });

    if (profileError) {
      console.error('❌ Error inserting profiles:', profileError);
      return;
    }
    console.log('✅ Sample profiles inserted successfully');

    // Insert sample products
    console.log('🛍️ Inserting sample products...');
    const { data: productData, error: productError } = await supabase
      .from('products')
      .insert(sampleProducts);

    if (productError) {
      console.error('❌ Error inserting products:', productError);
      return;
    }
    console.log('✅ Sample products inserted successfully');

    console.log('🎉 Database populated with sample data!');
    console.log(`📊 Added ${sampleProfiles.length} profiles and ${sampleProducts.length} products`);

  } catch (error) {
    console.error('💥 Error populating database:', error);
  }
}

// Run the script
populateDatabase();
