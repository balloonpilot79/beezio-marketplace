import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://yemgssttxhkgrivuodbz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzQwMjEsImV4cCI6MjA2NzUxMDAyMX0.EyargNCg2m77Tz-JoO5qs6Auxdcd3StvDKx9ZHkKcNM';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Checking existing tables...\n');
  
  const tablesToCheck = [
    'profiles',
    'products', 
    'categories',
    'affiliate_stores',
    'affiliate_store_products',
    'product_reviews',
    'seller_reviews',
    'orders',
    'affiliate_earnings'
  ];
  
  for (const table of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table '${table}' - MISSING or ERROR: ${error.message}`);
      } else {
        console.log(`✅ Table '${table}' - EXISTS`);
      }
    } catch (err) {
      console.log(`❌ Table '${table}' - ERROR: ${err.message}`);
    }
  }
}

async function applySQL() {
  console.log('\n📝 Reading FIX-MISSING-TABLES.sql...\n');
  
  const sqlPath = path.join(process.cwd(), 'FIX-MISSING-TABLES.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('⚠️  NOTE: This script uses the anon key which has limited permissions.');
  console.log('⚠️  To run SQL that creates tables, you need to:');
  console.log('   1. Go to https://supabase.com/dashboard/project/yemgssttxhkgrivuodbz/sql');
  console.log('   2. Click "New Query"');
  console.log('   3. Copy and paste the SQL from FIX-MISSING-TABLES.sql');
  console.log('   4. Click "Run"\n');
  console.log('📋 SQL file contains:');
  console.log('   - CREATE TABLE affiliate_store_products');
  console.log('   - CREATE TABLE product_reviews');
  console.log('   - CREATE TABLE seller_reviews');
  console.log('   - RLS policies for all tables');
  console.log('   - Storage bucket setup');
  console.log('   - Indexes for performance\n');
}

async function main() {
  console.log('🚀 Beezio Marketplace - Database Setup Check\n');
  console.log('=' .repeat(60));
  
  await checkTables();
  console.log('\n' + '='.repeat(60));
  await applySQL();
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
