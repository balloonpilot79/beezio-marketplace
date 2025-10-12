import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSchema() {
  console.log('🔍 Checking Database Schema for Seller Dashboard...\n');
  
  try {
    // Check orders table structure
    console.log('📋 Checking orders table...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(1);
    
    if (ordersError) {
      console.log('❌ Orders table error:', ordersError.message);
    } else {
      console.log('✅ Orders table accessible');
      if (orders && orders.length > 0) {
        console.log('   Available columns:', Object.keys(orders[0]));
      }
    }
    
    // Check order_items table structure
    console.log('\n📋 Checking order_items table...');
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*')
      .limit(1);
    
    if (orderItemsError) {
      console.log('❌ Order items table error:', orderItemsError.message);
    } else {
      console.log('✅ Order items table accessible');
      if (orderItems && orderItems.length > 0) {
        console.log('   Available columns:', Object.keys(orderItems[0]));
      }
    }
    
    // Check products table structure
    console.log('\n📋 Checking products table...');
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .limit(1);
    
    if (productsError) {
      console.log('❌ Products table error:', productsError.message);
    } else {
      console.log('✅ Products table accessible');
      if (products && products.length > 0) {
        console.log('   Available columns:', Object.keys(products[0]));
      }
    }
    
    // Test corrected queries for seller dashboard
    console.log('\n🔧 Testing corrected queries...');
    
    // Test orders query without customer_name
    const { data: ordersData, error: ordersQueryError } = await supabase
      .from('orders')
      .select('id, email, total_amount, status, created_at')
      .limit(1);
    
    if (ordersQueryError) {
      console.log('❌ Orders query failed:', ordersQueryError.message);
    } else {
      console.log('✅ Orders query successful with available columns');
    }
    
    // Test order_items query without seller_id
    const { data: orderItemsData, error: orderItemsQueryError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity, price')
      .limit(1);
    
    if (orderItemsQueryError) {
      console.log('❌ Order items query failed:', orderItemsQueryError.message);
    } else {
      console.log('✅ Order items query successful with available columns');
    }
    
  } catch (error) {
    console.error('Database check failed:', error);
  }
}

checkDatabaseSchema();