-- Fix RLS Policies for Security Advisor Errors
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. PROFILES TABLE - Enable RLS and create policies
-- ============================================

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles viewable by everyone" ON public.profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own profile (signup)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow everyone to view public profile info (for stores, affiliates, etc)
CREATE POLICY "Public profiles viewable by everyone" ON public.profiles
  FOR SELECT
  USING (true);


-- ============================================
-- 2. STOREFRONTS TABLE - Enable RLS and create policies
-- ============================================

-- Enable RLS on storefronts table
ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own storefront" ON public.storefronts;
DROP POLICY IF EXISTS "Users can update own storefront" ON public.storefronts;
DROP POLICY IF EXISTS "Users can insert own storefront" ON public.storefronts;
DROP POLICY IF EXISTS "Public storefronts viewable by everyone" ON public.storefronts;
DROP POLICY IF EXISTS "Users can delete own storefront" ON public.storefronts;

-- Allow users to view their own storefront
CREATE POLICY "Users can view own storefront" ON public.storefronts
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Allow users to update their own storefront
CREATE POLICY "Users can update own storefront" ON public.storefronts
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Allow users to create their own storefront
CREATE POLICY "Users can insert own storefront" ON public.storefronts
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Allow users to delete their own storefront
CREATE POLICY "Users can delete own storefront" ON public.storefronts
  FOR DELETE
  USING (auth.uid() = owner_id);

-- Allow everyone to view public storefronts
CREATE POLICY "Public storefronts viewable by everyone" ON public.storefronts
  FOR SELECT
  USING (true);


-- ============================================
-- 3. STOREFRONT_PRODUCTS TABLE - Enable RLS and create policies
-- ============================================

-- Enable RLS on storefront_products table
ALTER TABLE public.storefront_products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own storefront products" ON public.storefront_products;
DROP POLICY IF EXISTS "Users can manage own storefront products" ON public.storefront_products;
DROP POLICY IF EXISTS "Public storefront products viewable" ON public.storefront_products;

-- Allow users to view products in their own storefronts
CREATE POLICY "Users can view own storefront products" ON public.storefront_products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.storefronts 
      WHERE storefronts.id = storefront_products.storefront_id 
      AND storefronts.owner_id = auth.uid()
    )
  );

-- Allow users to manage (insert, update, delete) products in their own storefronts
CREATE POLICY "Users can manage own storefront products" ON public.storefront_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.storefronts 
      WHERE storefronts.id = storefront_products.storefront_id 
      AND storefronts.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.storefronts 
      WHERE storefronts.id = storefront_products.storefront_id 
      AND storefronts.owner_id = auth.uid()
    )
  );

-- Allow everyone to view public storefront products
CREATE POLICY "Public storefront products viewable" ON public.storefront_products
  FOR SELECT
  USING (true);


-- ============================================
-- 4. PAYOUTS TABLE - Enable RLS and create policies
-- ============================================

-- Note: Payouts table structure may vary. Skip if table doesn't exist or adjust columns as needed.
-- Common alternatives: seller_id, affiliate_id, recipient_id instead of user_id

DO $$ 
BEGIN
  -- Only enable RLS if the payouts table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payouts') THEN
    
    ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view own payouts" ON public.payouts;
    DROP POLICY IF EXISTS "Users can insert own payouts" ON public.payouts;
    DROP POLICY IF EXISTS "Admin can view all payouts" ON public.payouts;
    DROP POLICY IF EXISTS "Admin can update payouts" ON public.payouts;
    
    -- Create policies based on actual table structure
    -- Adjust column names based on your schema (seller_id, affiliate_id, etc.)
    
    -- Allow admin to view all payouts
    EXECUTE 'CREATE POLICY "Admin can view all payouts" ON public.payouts
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE profiles.user_id = auth.uid() 
          AND profiles.email IN (''jason@beezio.co'', ''jasonlovingsr@gmail.com'')
        )
      )';
    
    -- Allow admin to update payout status
    EXECUTE 'CREATE POLICY "Admin can update payouts" ON public.payouts
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE profiles.user_id = auth.uid() 
          AND profiles.email IN (''jason@beezio.co'', ''jasonlovingsr@gmail.com'')
        )
      )';
    
    RAISE NOTICE 'RLS policies created for payouts table';
  ELSE
    RAISE NOTICE 'Payouts table does not exist, skipping...';
  END IF;
END $$;


-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check which tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'storefronts', 'storefront_products', 'payouts')
ORDER BY tablename;

-- Check existing policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'storefronts', 'storefront_products', 'payouts')
ORDER BY tablename, policyname;
