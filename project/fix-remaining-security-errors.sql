-- =====================================================
-- FIX REMAINING 3 SUPABASE SECURITY ERRORS
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- ERROR 1 & 2: Security Definer Views
-- The views still have SECURITY DEFINER - we need to drop and recreate them properly
-- =====================================================

-- Fix referral_dashboard view - remove SECURITY DEFINER completely
DROP VIEW IF EXISTS public.referral_dashboard CASCADE;

CREATE VIEW public.referral_dashboard 
WITH (security_invoker = true)
AS
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.referral_code,
  p.total_referral_earnings,
  COUNT(DISTINCT r.id) as total_referrals,
  COUNT(DISTINCT CASE WHEN r.is_active = true THEN r.id END) as active_referrals,
  COALESCE(SUM(re.referral_commission), 0) as total_earned,
  COALESCE(SUM(CASE WHEN re.created_at >= NOW() - INTERVAL '30 days' THEN re.referral_commission ELSE 0 END), 0) as earned_last_30_days
FROM profiles p
LEFT JOIN referrals r ON p.id = r.referred_by_id
LEFT JOIN referral_earnings re ON r.id = re.referral_id
GROUP BY p.id, p.full_name, p.email, p.referral_code, p.total_referral_earnings;

COMMENT ON VIEW public.referral_dashboard IS 'Referral program dashboard (security_invoker = true)';

GRANT SELECT ON public.referral_dashboard TO authenticated;
GRANT SELECT ON public.referral_dashboard TO anon;


-- Fix affiliate_store_products view - remove SECURITY DEFINER completely
DROP VIEW IF EXISTS public.affiliate_store_products CASCADE;

CREATE VIEW public.affiliate_store_products 
WITH (security_invoker = true)
AS
SELECT 
  ap.id,
  ap.affiliate_id,
  ap.product_id,
  ap.clicks,
  ap.conversions,
  ap.total_earnings,
  ap.is_featured,
  ap.added_at,
  p.title,
  p.description,
  p.price,
  p.images,
  prof.full_name as seller_name
FROM affiliate_products ap
INNER JOIN products p ON ap.product_id = p.id
LEFT JOIN profiles prof ON p.seller_id = prof.id
WHERE p.is_active = true;

COMMENT ON VIEW public.affiliate_store_products IS 'Affiliate store products (security_invoker = true)';

GRANT SELECT ON public.affiliate_store_products TO authenticated;
GRANT SELECT ON public.affiliate_store_products TO anon;


-- =====================================================
-- ERROR 3: RLS Disabled on platform_settings table
-- =====================================================

-- Enable RLS on platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Anyone can view platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Only admins can update platform settings" ON platform_settings;
DROP POLICY IF EXISTS "Public can view settings" ON platform_settings;
DROP POLICY IF EXISTS "Service role can manage settings" ON platform_settings;

-- CREATE POLICIES FOR platform_settings
-- Allow public read access to platform settings
CREATE POLICY "Public can view platform settings"
ON platform_settings FOR SELECT
USING (true);

-- Only authenticated users with admin role can modify settings
CREATE POLICY "Admins can update platform settings"
ON platform_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR primary_role = 'admin')
  )
);

-- Only authenticated users with admin role can insert settings
CREATE POLICY "Admins can insert platform settings"
ON platform_settings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR primary_role = 'admin')
  )
);

-- Only authenticated users with admin role can delete settings
CREATE POLICY "Admins can delete platform settings"
ON platform_settings FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND (role = 'admin' OR primary_role = 'admin')
  )
);


-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check views are using security_invoker
SELECT 
  schemaname,
  viewname,
  viewowner
FROM pg_views
WHERE schemaname = 'public'
AND viewname IN ('referral_dashboard', 'affiliate_store_products');

-- Check RLS is enabled on platform_settings
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'platform_settings';

-- Check platform_settings policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'platform_settings'
ORDER BY policyname;


-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '✅ REMAINING 3 SECURITY ERRORS FIXED!';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '  1. ✅ referral_dashboard → Using security_invoker = true';
  RAISE NOTICE '  2. ✅ affiliate_store_products → Using security_invoker = true';
  RAISE NOTICE '  3. ✅ platform_settings → RLS enabled + 4 policies created';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Next: Refresh Security Advisor to verify 0 errors!';
  RAISE NOTICE '';
END $$;
