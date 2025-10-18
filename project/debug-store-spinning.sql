-- =====================================================
-- DEBUG: Store Customization Spinning Issue
-- =====================================================

-- STEP 1: Verify your store settings exist
SELECT 
  id,
  seller_id,
  store_name,
  store_theme,
  created_at
FROM store_settings 
ORDER BY created_at DESC 
LIMIT 5;

-- You should see your seller_id in the list

-- STEP 2: Check if the StoreCustomization component can access it
-- Run this to see if RLS policies are blocking
SELECT 
  ss.*,
  p.email,
  p.role,
  p.full_name
FROM store_settings ss
JOIN profiles p ON ss.seller_id = p.id
WHERE p.role = 'seller'
ORDER BY ss.created_at DESC
LIMIT 5;

-- STEP 3: Check RLS policies on store_settings
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'store_settings';

-- Should show policies allowing sellers to SELECT their own data

-- STEP 4: Test if you can select your own store_settings
-- Replace YOUR_USER_ID with your actual user ID from profiles
SELECT * 
FROM store_settings 
WHERE seller_id = 'YOUR_USER_ID_HERE';

-- If this returns nothing, RLS is blocking you

-- =====================================================
-- FIX: Ensure RLS allows authenticated users to read
-- =====================================================

-- Drop and recreate the SELECT policy to be more permissive
DROP POLICY IF EXISTS "Sellers can view their own store settings" ON store_settings;

CREATE POLICY "Sellers can view their own store settings" ON store_settings
  FOR SELECT 
  USING (
    auth.uid() = seller_id 
    OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('seller', 'admin'))
  );

-- Also ensure INSERT works for initial creation
DROP POLICY IF EXISTS "Sellers can insert their own store settings" ON store_settings;

CREATE POLICY "Sellers can insert their own store settings" ON store_settings
  FOR INSERT 
  WITH CHECK (auth.uid() = seller_id);

-- And UPDATE
DROP POLICY IF EXISTS "Sellers can update their own store settings" ON store_settings;

CREATE POLICY "Sellers can update their own store settings" ON store_settings
  FOR UPDATE 
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- =====================================================
-- SUCCESS CHECK
-- =====================================================
SELECT 'Store settings count:' as check_type, COUNT(*) as count FROM store_settings
UNION ALL
SELECT 'RLS policies:', COUNT(*) FROM pg_policies WHERE tablename = 'store_settings';
