-- =====================================================
-- DIAGNOSE: Store Customization Issue
-- =====================================================

-- STEP 1: Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('store_settings', 'affiliate_store_settings');

-- Expected: Should show both tables

-- =====================================================
-- STEP 2: Check if RLS is enabled
-- =====================================================
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('store_settings', 'affiliate_store_settings');

-- Expected: Both should show rls_enabled = true

-- =====================================================
-- STEP 3: Check if you have any store settings
-- =====================================================
SELECT 
  seller_id,
  store_name,
  store_theme,
  created_at
FROM store_settings;

-- This will show if you have any existing store settings

-- =====================================================
-- STEP 4: Create a default store setting for yourself
-- =====================================================
-- Run this to create initial store settings for your account
-- This should fix the spinning circle!

INSERT INTO store_settings (
  seller_id,
  store_name,
  store_description,
  store_theme,
  is_active
) VALUES (
  auth.uid(),
  'My Store',
  'Welcome to my store!',
  'modern',
  true
)
ON CONFLICT (seller_id) DO NOTHING;

-- Expected: "INSERT 0 1" or "INSERT 0 0" (if already exists)

-- =====================================================
-- STEP 5: Verify your store was created
-- =====================================================
SELECT 
  seller_id,
  store_name,
  store_theme,
  is_active,
  created_at
FROM store_settings
WHERE seller_id = auth.uid();

-- Expected: Should show your store settings
