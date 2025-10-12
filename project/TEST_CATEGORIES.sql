-- ========================================
-- TEST CATEGORIES AFTER SETUP
-- ========================================
-- Run this after running CATEGORY_SETUP_COMPLETE.sql
-- This will verify everything is working correctly

-- Test 1: Check if categories table exists and has data
SELECT 
  'Categories Table Test' as test_name,
  COUNT(*) as total_categories,
  COUNT(*) FILTER (WHERE is_active = true) as active_categories
FROM categories;

-- Test 2: List all categories (this is what ProductForm will see)
SELECT 
  'ProductForm Query Test' as test_name,
  id,
  name,
  description,
  sort_order,
  is_active
FROM categories 
WHERE is_active = true 
ORDER BY sort_order;

-- Test 3: Check RLS policies
SELECT 
  'RLS Policies Test' as test_name,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'categories';

-- Test 4: Check table permissions
SELECT 
  'Permissions Test' as test_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants 
WHERE table_name = 'categories';

-- Test 5: Verify products table compatibility
SELECT 
  'Products Table Compatibility' as test_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name = 'category_id';

-- Test 6: Sample category assignment test
-- This shows how products will reference categories
SELECT 
  'Category Assignment Example' as test_name,
  c.id as category_id,
  c.name as category_name,
  'This is how a product would reference: ' || c.id as example
FROM categories c 
WHERE c.id IN ('electronics', 'fashion', 'digital-products')
ORDER BY c.sort_order;

-- ========================================
-- VERIFICATION COMPLETE!
-- ========================================
-- If all tests show data, categories are ready for use!