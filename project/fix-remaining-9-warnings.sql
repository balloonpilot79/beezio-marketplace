-- =====================================================
-- FIX REMAINING 9 FUNCTION WARNINGS
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, let's see what functions actually exist
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN p.proconfig::text LIKE '%search_path%' THEN '✓ FIXED'
    ELSE '⚠ NEEDS FIX'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
AND p.proname IN (
  'generate_product_slug',
  'generate_store_slug', 
  'set_store_slug',
  'generate_referral_code_flexible',
  'increment_affiliate_product_metric',
  'update_affiliate_products_updated_at',
  'record_referral_commission'
)
ORDER BY p.proname;

-- Now fix them with the correct signatures
DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Loop through all unfixed functions and fix them
  FOR func_record IN 
    SELECT 
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND (p.proconfig IS NULL OR NOT p.proconfig::text LIKE '%search_path%')
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public', 
                     func_record.proname, 
                     func_record.args);
      RAISE NOTICE 'Fixed: %.%(%)', 'public', func_record.proname, func_record.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not fix: %.%(%): %', 'public', func_record.proname, func_record.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- Verify all functions are now fixed
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN p.proconfig::text LIKE '%search_path%' THEN '✅ FIXED'
    ELSE '⚠️ STILL MUTABLE'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prokind = 'f'
ORDER BY 
  CASE WHEN p.proconfig::text LIKE '%search_path%' THEN 1 ELSE 0 END,
  p.proname;

-- Success message
DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT COUNT(*)
  INTO remaining_count
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND (p.proconfig IS NULL OR NOT p.proconfig::text LIKE '%search_path%');

  RAISE NOTICE '';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '✅ FUNCTION WARNINGS FIXED!';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Remaining unfixed functions in public schema: %', remaining_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Refresh Security Advisor';
  RAISE NOTICE 'Expected: Only auth.leaked_password warning (safe to ignore)';
  RAISE NOTICE '';
END $$;
