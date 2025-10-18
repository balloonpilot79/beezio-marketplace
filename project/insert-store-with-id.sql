-- =====================================================
-- FIX: Insert store settings with actual user ID
-- =====================================================

-- STEP 1: Find your user ID
SELECT 
  id,
  email,
  role
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at DESC;

-- Copy your ID from the results above

-- =====================================================
-- STEP 2: Insert store settings with YOUR actual ID
-- =====================================================
-- Replace 'YOUR-USER-ID-HERE' with the ID from Step 1

INSERT INTO store_settings (
  seller_id,
  store_name,
  store_description,
  store_theme
) VALUES (
  'YOUR-USER-ID-HERE',  -- Paste your ID here!
  'My Store',
  'Welcome to my store!',
  'modern'
)
ON CONFLICT (seller_id) DO NOTHING;

-- =====================================================
-- STEP 3: Verify it worked
-- =====================================================

SELECT 
  seller_id,
  store_name,
  store_theme,
  created_at
FROM store_settings;

-- Should show your store!
