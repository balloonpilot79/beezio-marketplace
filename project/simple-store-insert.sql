-- =====================================================
-- FIX: Insert store settings without is_active column
-- =====================================================

-- STEP 1: Check what columns actually exist in store_settings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'store_settings'
ORDER BY ordinal_position;

-- This will show you all the actual columns

-- =====================================================
-- STEP 2: Simple insert without is_active
-- =====================================================

INSERT INTO store_settings (
  seller_id,
  store_name,
  store_description,
  store_theme
) VALUES (
  auth.uid(),
  'My Store',
  'Welcome to my store!',
  'modern'
)
ON CONFLICT (seller_id) DO NOTHING;

-- Expected: "INSERT 0 1" means success!

-- =====================================================
-- STEP 3: Verify your store was created
-- =====================================================

SELECT * FROM store_settings WHERE seller_id = auth.uid();

-- Should show your store settings
