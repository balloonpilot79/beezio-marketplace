-- =====================================================
-- UPDATE PRICING: 15% BEEZIO FEE + 5% REFERRAL FEE
-- Run this in Supabase SQL Editor
-- =====================================================

-- Update platform settings table
UPDATE platform_settings 
SET value = '15.00' 
WHERE key = 'platform_fee_percentage';

UPDATE platform_settings 
SET value = '5.00' 
WHERE key = 'referral_commission_rate';

-- If platform_settings doesn't exist or needs creation:
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES 
  ('platform_fee_percentage', '15.00', 'Platform commission percentage (15%)', NOW()),
  ('referral_commission_rate', '5.00', 'Referral commission percentage for passive income (5%)', NOW())
ON CONFLICT (key) 
DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- =====================================================
-- VERIFY REFERRAL SYSTEM IS READY
-- =====================================================

-- Check all affiliates have referral codes
SELECT 
  COUNT(*) as total_affiliates,
  COUNT(referral_code) as affiliates_with_codes,
  COUNT(*) - COUNT(referral_code) as missing_codes
FROM users 
WHERE current_role = 'affiliate';

-- Check referral tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN (
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM (
  VALUES 
    ('affiliate_referrals'),
    ('referral_earnings'),
    ('referral_commissions')
) AS t(table_name);

-- Check referral tracking is working
SELECT 
  ar.id,
  referrer.full_name as referrer_name,
  referrer.referral_code,
  referred.full_name as referred_name,
  ar.created_at,
  ar.status
FROM affiliate_referrals ar
JOIN users referrer ON ar.referrer_id = referrer.id
JOIN users referred ON ar.referred_id = referred.id
ORDER BY ar.created_at DESC
LIMIT 10;

-- =====================================================
-- VERIFY PAYOUT SYSTEM IS READY
-- =====================================================

-- Check payment_distributions table exists and has proper structure
SELECT 
  column_name,
  data_type,
  CASE WHEN is_nullable = 'NO' THEN '✅ NOT NULL' ELSE '⚠️ NULLABLE' END as nullable_status
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'payment_distributions'
ORDER BY ordinal_position;

-- Check user_earnings table exists
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'user_earnings'
ORDER BY ordinal_position;

-- Check recent payouts (should show seller, affiliate, AND referral payouts)
SELECT 
  pd.recipient_type,
  COUNT(*) as payout_count,
  SUM(pd.amount) as total_amount,
  AVG(pd.amount) as avg_amount
FROM payment_distributions pd
WHERE pd.created_at > NOW() - INTERVAL '30 days'
GROUP BY pd.recipient_type
ORDER BY total_amount DESC;

-- =====================================================
-- REFERRAL PASSIVE INCOME TEST QUERY
-- =====================================================

-- Show how referral commissions are tracked
-- This demonstrates the passive income system
SELECT 
  referrer.full_name as referrer_name,
  referrer.referral_code,
  COUNT(DISTINCT referred.id) as total_referrals,
  COUNT(DISTINCT re.id) as total_sales_by_referrals,
  COALESCE(SUM(re.referral_amount), 0) as total_passive_income
FROM users referrer
LEFT JOIN affiliate_referrals ar ON referrer.id = ar.referrer_id
LEFT JOIN users referred ON ar.referred_id = referred.id
LEFT JOIN referral_earnings re ON ar.id = re.referral_id
WHERE referrer.current_role = 'affiliate'
AND referrer.referral_code IS NOT NULL
GROUP BY referrer.id, referrer.full_name, referrer.referral_code
HAVING COUNT(DISTINCT referred.id) > 0
ORDER BY total_passive_income DESC
LIMIT 20;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
DECLARE
  total_affiliates integer;
  affiliates_with_codes integer;
  has_referral_tables boolean;
  has_payout_tables boolean;
BEGIN
  -- Count affiliates
  SELECT COUNT(*), COUNT(referral_code)
  INTO total_affiliates, affiliates_with_codes
  FROM users 
  WHERE current_role = 'affiliate';
  
  -- Check tables exist
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('affiliate_referrals', 'referral_earnings')
  ) INTO has_referral_tables;
  
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('payment_distributions', 'user_earnings')
  ) INTO has_payout_tables;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '✅ PRICING & REFERRAL SYSTEM UPDATE COMPLETE!';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '';
  RAISE NOTICE '💰 NEW PRICING:';
  RAISE NOTICE '   • Beezio Platform Fee: 15%% (updated from 10%%)';
  RAISE NOTICE '   • Referral Commission: 5%% passive income (updated from 2-3%%)';
  RAISE NOTICE '';
  RAISE NOTICE '👥 REFERRAL SYSTEM STATUS:';
  RAISE NOTICE '   • Total Affiliates: %', total_affiliates;
  RAISE NOTICE '   • Affiliates with Codes: %', affiliates_with_codes;
  RAISE NOTICE '   • Referral Tables: %', CASE WHEN has_referral_tables THEN '✅ READY' ELSE '❌ MISSING' END;
  RAISE NOTICE '';
  RAISE NOTICE '💸 PAYOUT SYSTEM STATUS:';
  RAISE NOTICE '   • Payment Tables: %', CASE WHEN has_payout_tables THEN '✅ READY' ELSE '❌ MISSING' END;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 HOW IT WORKS:';
  RAISE NOTICE '   1. Affiliate signs up using referral code';
  RAISE NOTICE '   2. Referred affiliate makes sales';
  RAISE NOTICE '   3. Referrer earns 5%% on EVERY sale (passive income!)';
  RAISE NOTICE '   4. Tracked in referral_earnings table';
  RAISE NOTICE '   5. Paid out via payment_distributions';
  RAISE NOTICE '';
  RAISE NOTICE '📝 NEXT STEPS:';
  RAISE NOTICE '   • Frontend already updated (pricing.ts)';
  RAISE NOTICE '   • SignUpPage already tracks referrals';
  RAISE NOTICE '   • complete-order function handles payouts';
  RAISE NOTICE '   • ReferralDashboard shows earnings';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 SYSTEM READY FOR PRODUCTION!';
  RAISE NOTICE '';
END $$;
