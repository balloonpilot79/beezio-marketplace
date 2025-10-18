-- =====================================================
-- CHECK WHAT ROLE VALUES ARE ALLOWED
-- =====================================================

-- Check the enum type definition
SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname = 'user_role'
ORDER BY e.enumsortorder;

-- This will show you all valid role values like:
-- buyer, seller, affiliate, fundraiser, etc.

-- =====================================================
-- ADD 'admin' TO THE user_role ENUM
-- =====================================================

-- Add 'admin' as a valid role value
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';

-- =====================================================
-- NOW MAKE YOURSELF ADMIN
-- =====================================================

-- First, see your current role
SELECT email, role FROM profiles ORDER BY created_at DESC LIMIT 5;

-- Update to admin (replace with YOUR email)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'YOUR_EMAIL@example.com';

-- Verify it worked
SELECT email, role FROM profiles WHERE role = 'admin';

-- =====================================================
-- Alternative: Check profiles table structure
-- =====================================================
SELECT 
  column_name, 
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'role';
