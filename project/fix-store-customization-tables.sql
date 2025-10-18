-- =====================================================
-- FIX: Store Customization Spinning Circle Issue
-- =====================================================

-- STEP 1: Check if store_settings tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('store_settings', 'affiliate_store_settings')
ORDER BY table_name;

-- Expected: Should show both tables
-- If NOT, we need to create them

-- =====================================================
-- STEP 2: Create store_settings table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  store_name TEXT,
  store_description TEXT,
  store_banner TEXT,
  store_logo TEXT,
  store_theme TEXT DEFAULT 'modern',
  custom_domain TEXT,
  social_links JSONB DEFAULT '{}',
  business_hours TEXT,
  shipping_policy TEXT,
  return_policy TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 3: Create affiliate_store_settings table if missing
-- =====================================================

CREATE TABLE IF NOT EXISTS affiliate_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  store_name TEXT,
  store_description TEXT,
  store_banner TEXT,
  store_logo TEXT,
  store_theme TEXT DEFAULT 'modern',
  custom_domain TEXT,
  social_links JSONB DEFAULT '{}',
  business_hours TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 4: Add RLS policies
-- =====================================================

-- Enable RLS
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_store_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Sellers can view their own store settings" ON store_settings;
DROP POLICY IF EXISTS "Sellers can update their own store settings" ON store_settings;
DROP POLICY IF EXISTS "Sellers can insert their own store settings" ON store_settings;
DROP POLICY IF EXISTS "Public can view active stores" ON store_settings;

DROP POLICY IF EXISTS "Affiliates can view their own store settings" ON affiliate_store_settings;
DROP POLICY IF EXISTS "Affiliates can update their own store settings" ON affiliate_store_settings;
DROP POLICY IF EXISTS "Affiliates can insert their own store settings" ON affiliate_store_settings;
DROP POLICY IF EXISTS "Public can view active affiliate stores" ON affiliate_store_settings;

-- Seller policies
CREATE POLICY "Sellers can view their own store settings" ON store_settings
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own store settings" ON store_settings
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own store settings" ON store_settings
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Public can view active stores" ON store_settings
  FOR SELECT USING (is_active = true);

-- Affiliate policies
CREATE POLICY "Affiliates can view their own store settings" ON affiliate_store_settings
  FOR SELECT USING (auth.uid() = affiliate_id);

CREATE POLICY "Affiliates can update their own store settings" ON affiliate_store_settings
  FOR UPDATE USING (auth.uid() = affiliate_id);

CREATE POLICY "Affiliates can insert their own store settings" ON affiliate_store_settings
  FOR INSERT WITH CHECK (auth.uid() = affiliate_id);

CREATE POLICY "Public can view active affiliate stores" ON affiliate_store_settings
  FOR SELECT USING (is_active = true);

-- =====================================================
-- STEP 5: Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_store_settings_seller ON store_settings(seller_id);
CREATE INDEX IF NOT EXISTS idx_store_settings_active ON store_settings(is_active);
CREATE INDEX IF NOT EXISTS idx_affiliate_store_settings_affiliate ON affiliate_store_settings(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_store_settings_active ON affiliate_store_settings(is_active);

-- =====================================================
-- STEP 6: Verify tables and policies created
-- =====================================================

-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('store_settings', 'affiliate_store_settings');

-- Check RLS is enabled
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN 'Enabled' ELSE 'Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('store_settings', 'affiliate_store_settings');

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Store customization tables ready!';
  RAISE NOTICE '📋 Tables: store_settings, affiliate_store_settings';
  RAISE NOTICE '🔒 RLS policies enabled';
END $$;
