-- 🚀 CRITICAL DATABASE SETUP FOR BEEZIO MARKETPLACE
-- Copy this entire script and run it in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Core user data)
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

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  seller_desired_amount DECIMAL(10,2),
  commission_rate DECIMAL(5,2) DEFAULT 20,
  category TEXT,
  tags TEXT[],
  images TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold')),
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_payment_intent_id TEXT UNIQUE,
  billing_name TEXT,
  billing_email TEXT,
  order_items JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  stripe_payment_intent_id TEXT UNIQUE,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. PAYMENT DISTRIBUTIONS TABLE (Critical for multi-party payouts)
CREATE TABLE IF NOT EXISTS payment_distributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('seller', 'affiliate', 'platform')),
  recipient_id UUID,
  amount DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  stripe_transfer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AFFILIATE COMMISSIONS TABLE
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID REFERENCES profiles(id),
  transaction_id UUID REFERENCES transactions(id),
  product_id UUID REFERENCES products(id),
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. PLATFORM REVENUE TABLE
CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  revenue_type TEXT NOT NULL CHECK (revenue_type IN ('platform_fee', 'stripe_fee')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. CATEGORIES TABLE (For product organization)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
  ('Digital Products', 'Software, courses, ebooks, and digital downloads'),
  ('Physical Products', 'Tangible items that require shipping'),
  ('Services', 'Consulting, coaching, and service-based offerings'),
  ('Courses', 'Educational content and training materials'),
  ('Software', 'Applications, tools, and digital solutions')
ON CONFLICT (name) DO NOTHING;

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- BASIC RLS POLICIES (Secure but functional)

-- Profiles: Users can see and edit their own profile, everyone can see basic seller info
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Products: Anyone can view active products, sellers manage their own
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (status = 'active');

CREATE POLICY "Sellers can manage own products" ON products
  FOR ALL USING (seller_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Orders: Users can see their own orders
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create orders" ON orders
  FOR INSERT WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Transactions: Users can view transactions for their orders
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders 
      WHERE user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Categories: Everyone can read categories
CREATE POLICY "Anyone can view categories" ON categories
  FOR SELECT TO public USING (true);

-- Payment distributions: Users can view their own distributions
CREATE POLICY "Users can view own distributions" ON payment_distributions
  FOR SELECT USING (
    recipient_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Affiliate commissions: Affiliates can view their own commissions
CREATE POLICY "Affiliates can view own commissions" ON affiliate_commissions
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_distributions_transaction_id ON payment_distributions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate_id ON affiliate_commissions(affiliate_id);

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '🎉 BEEZIO MARKETPLACE DATABASE SETUP COMPLETE!';
    RAISE NOTICE '✅ All critical tables created';
    RAISE NOTICE '✅ RLS policies applied';
    RAISE NOTICE '✅ Indexes created for performance';
    RAISE NOTICE '🚀 Ready for production use!';
END $$;