import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Setting up Beezio Database...');

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  console.log('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test connection first
async function testConnection() {
  try {
    console.log('🔌 Testing connection...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error && error.code === '42P01') {
      console.log('⚠️  Tables not found - will create them');
      return false;
    } else if (error) {
      console.error('❌ Connection error:', error.message);
      return false;
    }
    
    console.log('✅ Database already set up!');
    return true;
  } catch (err) {
    console.log('🔧 Need to create tables');
    return false;
  }
}

// Create essential tables
async function createEssentialTables() {
  console.log('📝 Creating essential tables...');

  const essentialSQL = `
    -- Create profiles table
    CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
        email TEXT NOT NULL,
        full_name TEXT,
        role TEXT CHECK (role IN ('buyer', 'seller', 'affiliate')) DEFAULT 'buyer',
        avatar_url TEXT,
        bio TEXT,
        website TEXT,
        location TEXT,
        phone TEXT,
        zip_code TEXT,
        stripe_customer_id TEXT,
        stripe_account_id TEXT,
        total_earnings DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Create categories table
    CREATE TABLE IF NOT EXISTS public.categories (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        icon_name TEXT,
        slug TEXT UNIQUE NOT NULL,
        parent_id UUID REFERENCES categories(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Create products table
    CREATE TABLE IF NOT EXISTS public.products (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
        category_id UUID REFERENCES categories(id),
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
        commission_rate DECIMAL(5,2) DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
        image_url TEXT,
        images TEXT[] DEFAULT ARRAY[]::TEXT[],
        is_active BOOLEAN DEFAULT true,
        inventory_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Enable RLS
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE products ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY IF NOT EXISTS "Users can view own profile" ON profiles
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY IF NOT EXISTS "Users can update own profile" ON profiles
      FOR UPDATE USING (auth.uid() = user_id);

    CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY IF NOT EXISTS "Anyone can view categories" ON categories
      FOR SELECT USING (true);

    CREATE POLICY IF NOT EXISTS "Anyone can view active products" ON products
      FOR SELECT USING (is_active = true);

    CREATE POLICY IF NOT EXISTS "Sellers can manage own products" ON products
      FOR ALL USING (seller_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: essentialSQL });
    if (error) {
      console.error('❌ SQL execution error:', error);
      return false;
    }
    console.log('✅ Essential tables created');
    return true;
  } catch (err) {
    console.error('❌ Table creation failed:', err.message);
    return false;
  }
}

// Alternative method - create tables one by one
async function createTablesStepByStep() {
  console.log('🔧 Creating tables step by step...');

  const tables = [
    {
      name: 'profiles',
      sql: `
        CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
          email TEXT NOT NULL,
          full_name TEXT,
          role TEXT CHECK (role IN ('buyer', 'seller', 'affiliate')) DEFAULT 'buyer',
          avatar_url TEXT,
          bio TEXT,
          website TEXT,
          location TEXT,
          phone TEXT,
          zip_code TEXT,
          stripe_customer_id TEXT,
          stripe_account_id TEXT,
          total_earnings DECIMAL(10,2) DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
      `
    }
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.rpc('exec', { query: table.sql });
      if (error && !error.message.includes('already exists')) {
        console.error(`❌ ${table.name}:`, error.message);
      } else {
        console.log(`✅ ${table.name} table ready`);
      }
    } catch (err) {
      console.log(`⚠️  ${table.name}:`, err.message);
    }
  }
}

async function main() {
  const tablesExist = await testConnection();
  
  if (!tablesExist) {
    console.log('🚀 Setting up database tables...');
    
    // Try method 1 first
    const success = await createEssentialTables();
    
    if (!success) {
      // Try method 2
      console.log('🔄 Trying alternative setup method...');
      await createTablesStepByStep();
    }
  }

  // Final test
  const finalTest = await testConnection();
  if (finalTest) {
    console.log('🎉 Database setup complete!');
    console.log('✅ You can now try logging in or creating an account');
  } else {
    console.log('⚠️  Database setup may need manual intervention');
    console.log('💡 Try visiting your Supabase dashboard to create tables manually');
  }
}

main().catch(console.error);
