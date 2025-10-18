-- =====================================================
-- FIX: Foreign Key Constraint Issue
-- =====================================================

-- The issue is that foreign keys reference auth.users 
-- but we should reference profiles instead (which has all users)

-- STEP 1: Drop existing foreign key constraints
ALTER TABLE store_settings 
  DROP CONSTRAINT IF EXISTS store_settings_seller_id_fkey;

ALTER TABLE affiliate_store_settings 
  DROP CONSTRAINT IF EXISTS affiliate_store_settings_affiliate_id_fkey;

-- STEP 2: Add correct foreign key constraints to profiles table
ALTER TABLE store_settings 
  ADD CONSTRAINT store_settings_seller_id_fkey 
  FOREIGN KEY (seller_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE affiliate_store_settings 
  ADD CONSTRAINT affiliate_store_settings_affiliate_id_fkey 
  FOREIGN KEY (affiliate_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- =====================================================
-- NOW BACKFILL: Create store settings for existing sellers
-- =====================================================

-- For sellers
INSERT INTO store_settings (
  seller_id,
  store_name,
  store_description,
  store_theme,
  social_links
)
SELECT 
  p.id,
  COALESCE(p.full_name, 'My Store'),
  'Welcome to my store! Browse our products and find great deals.',
  'modern',
  '{}'::jsonb
FROM profiles p
WHERE p.role = 'seller'
  AND NOT EXISTS (
    SELECT 1 FROM store_settings ss WHERE ss.seller_id = p.id
  );

-- For affiliates
INSERT INTO affiliate_store_settings (
  affiliate_id,
  store_name,
  store_description,
  store_theme,
  social_links
)
SELECT 
  p.id,
  COALESCE(p.full_name, 'My Affiliate Store'),
  'Check out these amazing products I recommend!',
  'modern',
  '{}'::jsonb
FROM profiles p
WHERE p.role = 'affiliate'
  AND NOT EXISTS (
    SELECT 1 FROM affiliate_store_settings ass WHERE ass.affiliate_id = p.id
  );

-- =====================================================
-- VERIFY: Check how many were created
-- =====================================================

SELECT 
  'Sellers with stores' as description,
  COUNT(*) as count
FROM store_settings

UNION ALL

SELECT 
  'Affiliates with stores' as description,
  COUNT(*) as count
FROM affiliate_store_settings

UNION ALL

SELECT 
  'Total sellers' as description,
  COUNT(*) as count
FROM profiles
WHERE role = 'seller'

UNION ALL

SELECT 
  'Total affiliates' as description,
  COUNT(*) as count
FROM profiles
WHERE role = 'affiliate';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Foreign key constraints fixed!';
  RAISE NOTICE '📋 Store settings created for all valid users';
  RAISE NOTICE '🔄 Now referencing profiles table instead of auth.users';
END $$;
