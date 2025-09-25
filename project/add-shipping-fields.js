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

async function addShippingFields() {
  console.log('🔧 Adding shipping fields to products table...\n');

  try {
    // Add shipping_options column
    const { error: shippingOptionsError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_options JSONB DEFAULT '[]';`
    });

    if (shippingOptionsError) {
      console.log('❌ Error adding shipping_options:', shippingOptionsError.message);
    } else {
      console.log('✅ shipping_options column added');
    }

    // Add requires_shipping column
    const { error: requiresShippingError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT true;`
    });

    if (requiresShippingError) {
      console.log('❌ Error adding requires_shipping:', requiresShippingError.message);
    } else {
      console.log('✅ requires_shipping column added');
    }

    console.log('\n🎉 Shipping fields update complete!');

  } catch (error) {
    console.log('❌ Error updating database:', error.message);
    console.log('\n💡 Manual SQL to run in Supabase SQL Editor:');
    console.log(`ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_options JSONB DEFAULT '[]';`);
    console.log(`ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT true;`);
  }
}

addShippingFields();