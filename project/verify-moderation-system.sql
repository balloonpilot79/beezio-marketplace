-- =====================================================
-- VERIFY MODERATION SYSTEM INSTALLATION
-- =====================================================

-- 1. Check if all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'reported_content',
    'disputes',
    'dispute_messages',
    'user_moderation',
    'seller_verification',
    'moderation_log'
  )
ORDER BY table_name;

-- Expected Result: Should show all 6 tables
-- ✅ disputes
-- ✅ dispute_messages
-- ✅ moderation_log
-- ✅ reported_content
-- ✅ seller_verification
-- ✅ user_moderation

-- =====================================================
-- 2. Check RLS is enabled on all tables
-- =====================================================
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'reported_content',
    'disputes',
    'dispute_messages',
    'user_moderation',
    'seller_verification',
    'moderation_log'
  )
ORDER BY tablename;

-- Expected: All should show "✅ Enabled"

-- =====================================================
-- 3. Check functions were created
-- =====================================================
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname IN (
  'update_moderation_updated_at',
  'is_user_restricted',
  'auto_expire_suspensions'
)
ORDER BY proname;

-- Expected Result: Should show all 3 functions

-- =====================================================
-- 4. Make yourself an ADMIN
-- =====================================================
-- IMPORTANT: Replace 'your@email.com' with your actual email!

-- First, check your current user
SELECT id, email, role FROM profiles WHERE email = auth.email();

-- Then update your role to admin
-- UPDATE profiles 
-- SET role = 'admin' 
-- WHERE email = 'YOUR_EMAIL_HERE@example.com';

-- Uncomment the line above and replace with your email, then run it

-- =====================================================
-- 5. Verify you're now an admin
-- =====================================================
-- SELECT id, email, role 
-- FROM profiles 
-- WHERE email = 'YOUR_EMAIL_HERE@example.com';

-- Expected Result: role should be 'admin'

-- =====================================================
-- DEPLOYMENT CHECKLIST
-- =====================================================
-- [ ] Step 1: Run verification query #1 (check tables) ✅
-- [ ] Step 2: Run verification query #2 (check RLS) ✅
-- [ ] Step 3: Run verification query #3 (check functions) ✅
-- [ ] Step 4: Update your email and make yourself admin
-- [ ] Step 5: Verify admin role
-- [ ] Step 6: Deploy frontend (git push)
-- [ ] Step 7: Test moderation dashboard
