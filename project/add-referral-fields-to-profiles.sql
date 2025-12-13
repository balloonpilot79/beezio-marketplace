-- ========================================
-- ADD REFERRAL FIELDS TO PROFILES TABLE
-- ========================================
-- This script adds the necessary columns for the 5% referral system
-- where affiliates earn passive income from recruiting other affiliates

-- 1. Add referral_code column (unique code for each affiliate)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Add referred_by column (who referred this user)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Add referral_code_used column (what code they used to sign up)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code_used TEXT;

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);

-- ========================================
-- GENERATE REFERRAL CODES FOR EXISTING AFFILIATES
-- ========================================

-- Function to generate unique referral code from name
CREATE OR REPLACE FUNCTION generate_referral_code_from_name(user_name TEXT, user_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 0;
  random_suffix TEXT;
BEGIN
  -- Create base code from name (first 4-6 chars, uppercase, alphanumeric only)
  base_code := UPPER(REGEXP_REPLACE(SUBSTRING(user_name, 1, 6), '[^A-Z0-9]', '', 'g'));
  
  -- If too short, pad with random characters
  IF LENGTH(base_code) < 4 THEN
    random_suffix := SUBSTRING(MD5(user_id::TEXT), 1, 4);
    base_code := base_code || random_suffix;
  END IF;
  
  -- Ensure at least 6 characters
  IF LENGTH(base_code) < 6 THEN
    random_suffix := SUBSTRING(MD5(user_id::TEXT || NOW()::TEXT), 1, 6 - LENGTH(base_code));
    base_code := base_code || random_suffix;
  END IF;
  
  -- Try to find unique code
  final_code := base_code;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter::TEXT;
  END LOOP;
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Generate codes for all existing affiliates/fundraisers without codes
UPDATE public.profiles
SET referral_code = generate_referral_code_from_name(
  COALESCE(full_name, email, 'USER'), 
  user_id
)
WHERE referral_code IS NULL
AND (primary_role = 'affiliate' OR primary_role = 'fundraiser');

-- ========================================
-- TRIGGER TO AUTO-CREATE REFERRAL CODE ON SIGNUP
-- ========================================

CREATE OR REPLACE FUNCTION auto_create_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create for affiliates/fundraisers
  IF (NEW.primary_role = 'affiliate' OR NEW.primary_role = 'fundraiser') AND NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code_from_name(
      COALESCE(NEW.full_name, NEW.email, 'USER'),
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_referral_code ON public.profiles;
CREATE TRIGGER trigger_auto_create_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION auto_create_referral_code();

-- ========================================
-- CREATE AFFILIATE_REFERRALS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  total_commission_earned DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_affiliate_id) -- Each affiliate can only be referred once
);

-- Enable RLS
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

-- Policies: Affiliates can view their referrals (both as referrer and referee)
DROP POLICY IF EXISTS "Affiliates can view their referrals" ON public.affiliate_referrals;
CREATE POLICY "Affiliates can view their referrals"
ON public.affiliate_referrals FOR SELECT
USING (
  auth.uid()::text = referrer_affiliate_id::text 
  OR auth.uid()::text = referred_affiliate_id::text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer ON public.affiliate_referrals(referrer_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred ON public.affiliate_referrals(referred_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_code ON public.affiliate_referrals(referral_code);

-- ========================================
-- CREATE REFERRAL_COMMISSIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  order_item_id UUID,
  sale_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 5.00, -- 5% of platform fee
  commission_amount DECIMAL(10,2) NOT NULL, -- Actual $ earned
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

-- Policy: Referrers can view their commissions
DROP POLICY IF EXISTS "Referrers can view their commissions" ON public.referral_commissions;
CREATE POLICY "Referrers can view their commissions"
ON public.referral_commissions FOR SELECT
USING (auth.uid()::text = referrer_id::text);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON public.referral_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred ON public.referral_commissions(referred_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_order ON public.referral_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON public.referral_commissions(status);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check columns added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'profiles'
AND column_name IN ('referral_code', 'referred_by', 'referral_code_used')
ORDER BY column_name;

-- Check affiliates with referral codes
SELECT 
  user_id,
  email,
  full_name,
  referral_code,
  primary_role
FROM public.profiles
WHERE primary_role IN ('affiliate', 'fundraiser')
AND referral_code IS NOT NULL
LIMIT 10;

-- Check tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('affiliate_referrals', 'referral_commissions')
ORDER BY table_name;

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('affiliate_referrals', 'referral_commissions')
ORDER BY tablename;

-- Sample referral link format
SELECT 
  user_id,
  email,
  referral_code,
  CONCAT('https://beezio.co/signup?ref=', referral_code) AS referral_link
FROM public.profiles
WHERE primary_role IN ('affiliate', 'fundraiser')
AND referral_code IS NOT NULL
LIMIT 5;
