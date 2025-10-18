-- =====================================================
-- QUICK FIX: Make Your Account Admin & Verify
-- =====================================================

-- Step 1: Find your user ID and current role
SELECT 
  id,
  email,
  role,
  full_name,
  created_at
FROM profiles 
ORDER BY created_at DESC 
LIMIT 10;

-- Step 2: Update YOUR account to admin
-- Replace 'YOUR_EMAIL@example.com' with the email from Step 1
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'YOUR_EMAIL@example.com';

-- Expected: "UPDATE 1" means success

-- Step 3: Verify the change worked
SELECT 
  id,
  email,
  role,
  full_name
FROM profiles 
WHERE role = 'admin';

-- Expected: Should show your account with role = 'admin'

-- =====================================================
-- Alternative: Make ALL users admin (for testing only!)
-- =====================================================
-- Uncomment if you want to make everyone admin temporarily:
-- UPDATE profiles SET role = 'admin';

-- =====================================================
-- Check if moderation tables have data
-- =====================================================
SELECT 'reported_content' as table_name, COUNT(*) as count FROM reported_content
UNION ALL
SELECT 'disputes', COUNT(*) FROM disputes
UNION ALL
SELECT 'user_moderation', COUNT(*) FROM user_moderation
UNION ALL
SELECT 'seller_verification', COUNT(*) FROM seller_verification;

-- Expected: All should show 0 (empty tables - no reports yet)
