import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStoreTables() {
  console.log('🔍 Checking store customization tables...\n');

  try {
    // Check store_settings table
    const { data: storeSettingsData, error: storeSettingsError } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1);

    if (storeSettingsError) {
      console.log('❌ store_settings table: NOT FOUND');
      console.log('   Error:', storeSettingsError.message);
    } else {
      console.log('✅ store_settings table: EXISTS');
    }

    // Check affiliate_store_settings table
    const { data: affiliateStoreSettingsData, error: affiliateStoreSettingsError } = await supabase
      .from('affiliate_store_settings')
      .select('*')
      .limit(1);

    if (affiliateStoreSettingsError) {
      console.log('❌ affiliate_store_settings table: NOT FOUND');
      console.log('   Error:', affiliateStoreSettingsError.message);
    } else {
      console.log('✅ affiliate_store_settings table: EXISTS');
    }

    // Check if products table has shipping fields
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('shipping_options, requires_shipping')
      .limit(1);

    if (productsError) {
      console.log('❌ products table shipping fields: ERROR');
      console.log('   Error:', productsError.message);
    } else {
      console.log('✅ products table shipping fields: EXISTS');
    }

  } catch (error) {
    console.log('❌ Error checking database:', error.message);
  }
}

checkStoreTables();