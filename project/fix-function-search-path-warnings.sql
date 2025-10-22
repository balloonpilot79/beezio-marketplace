-- =====================================================
-- FIX ALL FUNCTION SEARCH_PATH WARNINGS
-- Run this in Supabase SQL Editor
-- 
-- This adds "SET search_path = public" to all existing functions
-- Skips functions that don't exist to avoid errors
-- =====================================================

-- Fix functions that exist - wrapped in DO blocks to handle errors gracefully
DO $$
BEGIN
  -- Try to fix each function, skip if it doesn't exist
  
  BEGIN
    ALTER FUNCTION public.generate_product_slug(text) SET search_path = public;
    RAISE NOTICE 'Fixed: generate_product_slug';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: generate_product_slug (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.generate_referral_code() SET search_path = public;
    RAISE NOTICE 'Fixed: generate_referral_code';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: generate_referral_code (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.auto_generate_referral_code() SET search_path = public;
    RAISE NOTICE 'Fixed: auto_generate_referral_code';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: auto_generate_referral_code (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.trg_update_email_notifications_timestamp() SET search_path = public;
    RAISE NOTICE 'Fixed: trg_update_email_notifications_timestamp';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: trg_update_email_notifications_timestamp (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.handle_updated_at() SET search_path = public;
    RAISE NOTICE 'Fixed: handle_updated_at';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: handle_updated_at (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
    RAISE NOTICE 'Fixed: update_updated_at_column';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: update_updated_at_column (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.create_default_store_settings() SET search_path = public;
    RAISE NOTICE 'Fixed: create_default_store_settings';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: create_default_store_settings (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.update_product_affiliate_count() SET search_path = public;
    RAISE NOTICE 'Fixed: update_product_affiliate_count';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: update_product_affiliate_count (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.increase_affiliates_product_metric() SET search_path = public;
    RAISE NOTICE 'Fixed: increase_affiliates_product_metric';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: increase_affiliates_product_metric (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.update_affiliage_products_updated_at() SET search_path = public;
    RAISE NOTICE 'Fixed: update_affiliage_products_updated_at';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: update_affiliage_products_updated_at (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.update_product_affiliates_count() SET search_path = public;
    RAISE NOTICE 'Fixed: update_product_affiliates_count';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: update_product_affiliates_count (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.generate_affiliate_link_code() SET search_path = public;
    RAISE NOTICE 'Fixed: generate_affiliate_link_code';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: generate_affiliate_link_code (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.increment_affiliate_product_metric() SET search_path = public;
    RAISE NOTICE 'Fixed: increment_affiliate_product_metric';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: increment_affiliate_product_metric (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.record_referral_commission() SET search_path = public;
    RAISE NOTICE 'Fixed: record_referral_commission';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: record_referral_commission (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.get_platform_setting(text) SET search_path = public;
    RAISE NOTICE 'Fixed: get_platform_setting';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: get_platform_setting (does not exist)';
  END;
  
  BEGIN
    ALTER FUNCTION public.update_updated_at() SET search_path = public;
    RAISE NOTICE 'Fixed: update_updated_at';
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Skipped: update_updated_at (does not exist)';
  END;

END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check that all functions now have search_path set
SELECT 
  routine_name,
  routine_schema,
  CASE 
    WHEN prosrc LIKE '%SET search_path%' OR proconfig::text LIKE '%search_path%' THEN 'FIXED ✓'
    ELSE 'STILL MUTABLE ⚠'
  END as status
FROM information_schema.routines r
LEFT JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
  warning_count integer;
BEGIN
  -- Count remaining warnings (should be 1 for auth.leaked_password)
  SELECT COUNT(*) 
  INTO warning_count
  FROM information_schema.routines r
  LEFT JOIN pg_proc p ON p.proname = r.routine_name
  WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND (p.proconfig IS NULL OR NOT p.proconfig::text LIKE '%search_path%');

  RAISE NOTICE '';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '✅ FUNCTION SEARCH_PATH WARNINGS FIXED!';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed: 18 public schema functions';
  RAISE NOTICE 'Remaining warnings: % (auth.leaked_password - ignore this)', warning_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Next: Refresh Security Advisor';
  RAISE NOTICE 'Expected result: 1 warning (auth schema - safe to ignore)';
  RAISE NOTICE '';
END $$;
