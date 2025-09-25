import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProductColumns() {
  console.log('🔍 Checking products table columns...\n');

  try {
    // Try to select all columns from products
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Query failed:', error.message);
    } else if (data && data.length > 0) {
      console.log('✅ Products table columns:');
      Object.keys(data[0]).forEach(column => {
        console.log(`   - ${column}: ${typeof data[0][column]}`);
      });
    } else {
      console.log('⚠️  No products found');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

checkProductColumns().catch(console.error);