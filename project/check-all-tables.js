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

async function checkAllTables() {
  console.log('🔍 Checking all relevant tables...\n');

  const tablesToCheck = [
    'store_settings',
    'affiliate_store_settings',
    'affiliate_stores',
    'profiles',
    'products'
  ];

  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: NOT FOUND - ${error.message}`);
      } else {
        console.log(`✅ ${table}: EXISTS`);
      }
    } catch (error) {
      console.log(`❌ ${table}: ERROR - ${error.message}`);
    }
  }
}

checkAllTables();