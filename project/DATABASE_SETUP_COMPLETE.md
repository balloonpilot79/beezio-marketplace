# 🔧 DATABASE CONFIGURATION GUIDE

## 🎯 **IMMEDIATE ACTIONS NEEDED**

### **Step 1: Configure Netlify Environment Variables**

Go to your Netlify dashboard and add these environment variables:

1. **Go to**: https://app.netlify.com/sites/beezio-marketplace/settings/env
2. **Add these variables**:

```bash
VITE_SUPABASE_URL=https://yemgssttxhkgrivuodbz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc2MzIxNzQsImV4cCI6MjA0MzIwODE3NH0.99m7vVVYgc0Z2bzbOLqXRoiuIJYQFSG0wpJuQQwQ96I
```

### **Step 2: Database Tables Setup**

Your database needs these essential tables (run in Supabase SQL Editor):

```sql
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
```

### **Step 3: Row Level Security (RLS) Policies**

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (users can see their own data)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (status = 'active');

CREATE POLICY "Sellers can manage own products" ON products
  FOR ALL USING (seller_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
```

## 🚨 **WHY DATABASE TESTS ARE FAILING**

### **Current Problems:**
1. **Missing Environment Variables** - Netlify doesn't have your Supabase credentials
2. **RLS Policies** - Anonymous users can't query profiles table
3. **Missing Tables** - Some required tables may not exist

### **Quick Fix for Testing:**

**Option A: Configure Environment Variables (Recommended)**
- Add Supabase credentials to Netlify environment variables
- Redeploy your site

**Option B: Temporarily Disable RLS for Testing**
```sql
-- TEMPORARY: Disable RLS on profiles for testing
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
```

## 🎯 **PRIORITY ORDER**

### **Critical (Must Have)**
1. ✅ Environment variables in Netlify
2. ✅ `profiles` table
3. ✅ `products` table
4. ✅ `orders` table
5. ✅ `transactions` table
6. ✅ `payment_distributions` table

### **Important (For Full Functionality)**
7. ✅ `affiliate_commissions` table
8. ✅ `platform_revenue` table
9. ✅ RLS policies
10. ✅ Indexes for performance

### **Optional (Can Add Later)**
- Product reviews tables
- Shipping/fulfillment tables
- Analytics tables
- Chat/messaging tables

## 🚀 **IMMEDIATE NEXT STEPS**

1. **Go to Netlify** → Add environment variables
2. **Go to Supabase** → Run the SQL above
3. **Redeploy your site** → `npm run build && netlify deploy --prod`
4. **Test the database connection** → Should work!

Your marketplace core functionality works without the database - the payment calculations, UI, and routing all function independently. The database is needed for user accounts, product storage, and transaction history.