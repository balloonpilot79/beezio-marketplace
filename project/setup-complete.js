#!/usr/bin/env node

// Complete Setup Script for Beezio Marketplace
// Tests Supabase and Stripe connections, sets up database tables, and verifies configuration

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

console.log('🚀 Starting Beezio Marketplace Setup...\n');

// Test Supabase Connection
async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...');
  try {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    
    if (error && error.code === '42P01') {
      console.log('⚠️  Tables not found - will create them');
      return { connected: true, tablesExist: false };
    } else if (error) {
      throw error;
    }
    
    console.log('✅ Supabase Connected Successfully');
    console.log(`📊 Database URL: ${supabaseUrl}`);
    return { connected: true, tablesExist: true };
  } catch (error) {
    console.log('❌ Supabase Connection Failed:', error.message);
    return { connected: false, tablesExist: false };
  }
}

// Test Stripe Connection
async function testStripeConnection() {
  console.log('🔍 Testing Stripe Connection...');
  try {
    const account = await stripe.accounts.retrieve();
    console.log('✅ Stripe Connected Successfully');
    console.log(`💳 Account ID: ${account.id}`);
    console.log(`🏦 Account Type: ${account.type}`);
    console.log(`🌍 Country: ${account.country}`);
    return { connected: true, account };
  } catch (error) {
    console.log('❌ Stripe Connection Failed:', error.message);
    return { connected: false, account: null };
  }
}

// Create Essential Database Tables
async function createDatabaseTables() {
  console.log('🏗️  Creating Database Tables...');
  
  const tables = [
    {
      name: 'profiles',
      sql: `
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          full_name TEXT,
          email TEXT,
          role TEXT DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'affiliate', 'admin')),
          avatar_url TEXT,
          location TEXT,
          bio TEXT,
          stripe_account_id TEXT,
          stripe_customer_id TEXT,
          commission_rate DECIMAL(5,2) DEFAULT 0,
          total_earnings DECIMAL(10,2) DEFAULT 0,
          current_balance DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        );
      `
    },
    {
      name: 'categories',
      sql: `
        CREATE TABLE IF NOT EXISTS categories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          image_url TEXT,
          parent_id UUID REFERENCES categories(id),
          sort_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'products',
      sql: `
        CREATE TABLE IF NOT EXISTS products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          price DECIMAL(10,2) NOT NULL,
          images TEXT[] DEFAULT '{}',
          videos TEXT[] DEFAULT '{}',
          tags TEXT[] DEFAULT '{}',
          category_id UUID REFERENCES categories(id),
          stock_quantity INTEGER DEFAULT 0,
          commission_rate DECIMAL(5,2) DEFAULT 0,
          commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'flat_rate')),
          flat_commission_amount DECIMAL(10,2) DEFAULT 0,
          is_subscription BOOLEAN DEFAULT false,
          subscription_interval TEXT CHECK (subscription_interval IN ('weekly', 'monthly', 'yearly')),
          shipping_options JSONB DEFAULT '[]',
          requires_shipping BOOLEAN DEFAULT true,
          is_active BOOLEAN DEFAULT true,
          sales_count INTEGER DEFAULT 0,
          average_rating DECIMAL(3,2) DEFAULT 0,
          review_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'orders',
      sql: `
        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          buyer_id UUID REFERENCES profiles(id),
          total_amount DECIMAL(10,2) NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded')),
          payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
          stripe_payment_intent_id TEXT,
          shipping_address JSONB,
          billing_address JSONB,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'order_items',
      sql: `
        CREATE TABLE IF NOT EXISTS order_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
          product_id UUID REFERENCES products(id),
          seller_id UUID REFERENCES profiles(id),
          affiliate_id UUID REFERENCES profiles(id),
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(10,2) NOT NULL,
          commission_rate DECIMAL(5,2) DEFAULT 0,
          affiliate_commission_rate DECIMAL(5,2) DEFAULT 0,
          shipping_cost DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    },
    {
      name: 'commissions',
      sql: `
        CREATE TABLE IF NOT EXISTS commissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          affiliate_id UUID REFERENCES profiles(id),
          product_id UUID REFERENCES products(id),
          order_id UUID REFERENCES orders(id),
          commission_rate DECIMAL(5,2) NOT NULL,
          commission_amount DECIMAL(10,2) NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
          paid_at TIMESTAMP WITH TIME ZONE,
          stripe_transfer_id TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    }
  ];

  let successCount = 0;
  for (const table of tables) {
    try {
      const { error } = await supabase.rpc('exec', { sql: table.sql });
      if (error && !error.message.includes('already exists')) {
        console.log(`❌ Failed to create ${table.name}:`, error.message);
      } else {
        console.log(`✅ Table ${table.name} ready`);
        successCount++;
      }
    } catch (err) {
      // Try direct query if RPC fails
      try {
        await supabase.query(table.sql);
        console.log(`✅ Table ${table.name} ready`);
        successCount++;
      } catch (directError) {
        console.log(`❌ Failed to create ${table.name}:`, directError.message);
      }
    }
  }
  
  console.log(`🎯 Created ${successCount}/${tables.length} tables successfully`);
  return successCount === tables.length;
}

// Create Row Level Security Policies
async function createRLSPolicies() {
  console.log('🔐 Setting up Row Level Security...');
  
  const policies = [
    {
      table: 'profiles',
      sql: `
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY IF NOT EXISTS "Users can view all profiles" ON profiles
          FOR SELECT TO authenticated USING (true);
          
        CREATE POLICY IF NOT EXISTS "Users can update own profile" ON profiles
          FOR UPDATE TO authenticated USING (auth.uid() = user_id);
          
        CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON profiles
          FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
      `
    },
    {
      table: 'products',
      sql: `
        ALTER TABLE products ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY IF NOT EXISTS "Anyone can view active products" ON products
          FOR SELECT TO authenticated USING (is_active = true);
          
        CREATE POLICY IF NOT EXISTS "Sellers can manage own products" ON products
          FOR ALL TO authenticated USING (seller_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
      `
    },
    {
      table: 'orders',
      sql: `
        ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY IF NOT EXISTS "Users can view own orders" ON orders
          FOR SELECT TO authenticated USING (buyer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
          
        CREATE POLICY IF NOT EXISTS "Users can create own orders" ON orders
          FOR INSERT TO authenticated WITH CHECK (buyer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
      `
    }
  ];

  for (const policy of policies) {
    try {
      const { error } = await supabase.rpc('exec', { sql: policy.sql });
      if (error && !error.message.includes('already exists')) {
        console.log(`⚠️  RLS policy issue for ${policy.table}:`, error.message);
      } else {
        console.log(`🔒 RLS enabled for ${policy.table}`);
      }
    } catch (err) {
      console.log(`⚠️  RLS setup warning for ${policy.table}:`, err.message);
    }
  }
}

// Insert Sample Categories
async function insertSampleData() {
  console.log('📦 Inserting sample categories...');
  
  const categories = [
    { name: 'Electronics', description: 'Phones, computers, gadgets' },
    { name: 'Fashion', description: 'Clothing, shoes, accessories' },
    { name: 'Home & Garden', description: 'Furniture, tools, decor' },
    { name: 'Books', description: 'Physical and digital books' },
    { name: 'Sports', description: 'Equipment and apparel' },
    { name: 'Beauty', description: 'Cosmetics and skincare' }
  ];

  try {
    const { error } = await supabase.from('categories').upsert(categories, { 
      onConflict: 'name',
      ignoreDuplicates: true 
    });
    
    if (error) {
      console.log('⚠️  Sample data warning:', error.message);
    } else {
      console.log('✅ Sample categories added');
    }
  } catch (err) {
    console.log('⚠️  Sample data setup:', err.message);
  }
}

// Test Stripe Webhook Configuration
async function testStripeWebhooks() {
  console.log('🔔 Checking Stripe Webhooks...');
  
  try {
    const webhooks = await stripe.webhookEndpoints.list({ limit: 10 });
    
    if (webhooks.data.length === 0) {
      console.log('⚠️  No webhooks configured - payments will work but some features may be limited');
      console.log('💡 Consider setting up webhooks for production deployment');
    } else {
      console.log(`✅ Found ${webhooks.data.length} webhook(s) configured`);
      webhooks.data.forEach(webhook => {
        console.log(`   📍 ${webhook.url} - ${webhook.status}`);
      });
    }
  } catch (err) {
    console.log('⚠️  Webhook check:', err.message);
  }
}

// Main Setup Function
async function main() {
  console.log('🎯 Environment Check:');
  console.log(`   Supabase URL: ${supabaseUrl ? '✅' : '❌'}`);
  console.log(`   Supabase Key: ${supabaseKey ? '✅' : '❌'}`);
  console.log(`   Stripe Key: ${stripeSecretKey ? '✅' : '❌'}\n`);

  if (!supabaseUrl || !supabaseKey || !stripeSecretKey) {
    console.log('❌ Missing environment variables. Please check your .env file.\n');
    return;
  }

  // Test connections
  const supabaseTest = await testSupabaseConnection();
  const stripeTest = await testStripeConnection();
  
  console.log('');

  if (!supabaseTest.connected) {
    console.log('❌ Cannot proceed without Supabase connection\n');
    return;
  }

  if (!stripeTest.connected) {
    console.log('⚠️  Stripe connection failed - payment features will not work\n');
  }

  // Set up database
  if (!supabaseTest.tablesExist) {
    await createDatabaseTables();
    await createRLSPolicies();
    await insertSampleData();
  } else {
    console.log('✅ Database tables already exist');
  }

  // Test webhooks
  if (stripeTest.connected) {
    await testStripeWebhooks();
  }

  console.log('\n🎉 Setup Complete!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Start the development server: npm run dev');
  console.log('   2. Create an account and test user registration');
  console.log('   3. Try creating a product as a seller');
  console.log('   4. Test the payment flow with Stripe test cards');
  console.log('\n💳 Test Cards:');
  console.log('   Success: 4242 4242 4242 4242');
  console.log('   Decline: 4000 0000 0000 0002');
  console.log('   Use any future expiry date and CVC\n');
}

// Run the setup
main().catch(console.error);
