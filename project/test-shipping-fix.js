import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testShippingFields() {
  console.log('🔍 Testing shipping fields access...\n');

  try {
    // Try to select shipping fields
    const { data, error } = await supabase
      .from('products')
      .select('id, shipping_options, requires_shipping')
      .limit(1);

    if (error) {
      console.log('❌ Shipping fields not accessible:', error.message);
      return false;
    } else {
      console.log('✅ Shipping fields are accessible');
      console.log('Sample data:', data);
      return true;
    }
  } catch (error) {
    console.log('❌ Error testing shipping fields:', error.message);
    return false;
  }
}

async function addShippingFieldsManually() {
  console.log('🔧 Attempting to add shipping fields...\n');

  try {
    // First check if columns exist by trying to select them
    const fieldsExist = await testShippingFields();
    if (fieldsExist) {
      console.log('✅ Shipping fields already exist!');
      return;
    }

    console.log('❌ Shipping fields missing. Please run this SQL in Supabase SQL Editor:');
    console.log(`
-- Add shipping_options column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS shipping_options JSONB DEFAULT '[]'::jsonb;

-- Add requires_shipping column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT true;
    `);

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

addShippingFieldsManually();