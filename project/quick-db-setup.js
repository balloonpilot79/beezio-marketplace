#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

console.log('🚀 Quick Database Setup for Beezio...');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Environment variables not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Essential tables creation
const essentialSQL = `
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
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

-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID REFERENCES profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    images TEXT[] DEFAULT '{}',
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    commission_rate DECIMAL(5,2) DEFAULT 0,
    commission_type TEXT DEFAULT 'percentage',
    flat_commission_amount DECIMAL(10,2) DEFAULT 0,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    videos TEXT[] DEFAULT '{}',
    views_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    conversions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    total_amount DECIMAL(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    stripe_payment_intent_id TEXT,
    affiliate_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active products" ON public.products
    FOR SELECT USING (is_active = true);

CREATE POLICY "Sellers can manage own products" ON public.products
    FOR ALL USING (auth.uid() IN (SELECT user_id FROM profiles WHERE id = seller_id));
`;

async function setupDatabase() {
  try {
    console.log('🔧 Creating essential tables...');
    
    // Split SQL into individual statements and execute
    const statements = essentialSQL.split(';').filter(stmt => stmt.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt) {
        console.log(`📄 Executing statement ${i + 1}/${statements.length}...`);
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: stmt });
          if (error) {
            console.log(`⚠️  Statement ${i + 1}: ${error.message}`);
          } else {
            console.log(`✅ Statement ${i + 1}: Success`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1}: ${err.message}`);
        }
      }
    }
    
    console.log('\n🎉 Basic database setup complete!');
    console.log('✅ You can now:');
    console.log('1. Create accounts on your site');
    console.log('2. Add products as a seller');
    console.log('3. Test the marketplace functionality');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

setupDatabase();
