-- Affiliate Referral Program - Database Setup (CORRECTED)
-- Run this in Supabase SQL Editor

-- ========================================
-- STEP 0: Check what columns exist in users table
-- ========================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Common column names to look for:
-- full_name, name, first_name, last_name, username, display_name, email

-- ========================================
-- STEP 1: Add columns to users table
-- ========================================

-- Add referral_code column (unique code for each affiliate)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Add referred_by_code column (stores who referred them)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by_code ON public.users(referred_by_code);

-- ========================================
-- STEP 2: Create affiliate_referrals table
-- ========================================

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id BIGINT NOT NULL,
  referred_id BIGINT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_referrer FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_referred FOREIGN KEY (referred_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_referred UNIQUE(referred_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer ON public.affiliate_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred ON public.affiliate_referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_code ON public.affiliate_referrals(referral_code);

-- Enable RLS
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Affiliates can view their referrals" ON public.affiliate_referrals;
DROP POLICY IF EXISTS "Affiliates can view if they were referred" ON public.affiliate_referrals;

CREATE POLICY "Affiliates can view their referrals"
ON public.affiliate_referrals FOR SELECT TO authenticated
USING (referrer_id::text = auth.uid()::text);

CREATE POLICY "Affiliates can view if they were referred"
ON public.affiliate_referrals FOR SELECT TO authenticated
USING (referred_id::text = auth.uid()::text);

-- ========================================
-- STEP 3: Create referral_commissions table
-- ========================================

CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id BIGINT NOT NULL,
  referred_affiliate_id BIGINT NOT NULL,
  order_id UUID NOT NULL,
  order_item_id UUID,
  sale_amount DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 2.00,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_referrer FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_referred_affiliate FOREIGN KEY (referred_affiliate_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON public.referral_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred ON public.referral_commissions(referred_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_order ON public.referral_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON public.referral_commissions(status);

-- Enable RLS
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Affiliates can view their referral earnings" ON public.referral_commissions;

CREATE POLICY "Affiliates can view their referral earnings"
ON public.referral_commissions FOR SELECT TO authenticated
USING (referrer_id::text = auth.uid()::text);

-- ========================================
-- STEP 4: Function to generate referral code (FLEXIBLE)
-- ========================================

-- This version uses email username if no name column exists
CREATE OR REPLACE FUNCTION generate_referral_code_flexible(user_id BIGINT, user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  name_prefix TEXT;
  random_suffix TEXT;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Get first 4 letters from email username (before @)
  name_prefix := UPPER(SUBSTRING(SPLIT_PART(user_email, '@', 1), 1, 4));
  
  -- Fallback if email prefix is too short
  IF LENGTH(name_prefix) < 4 THEN
    name_prefix := UPPER(LPAD(name_prefix, 4, 'X'));
  END IF;
  
  -- Loop until we find a unique code
  LOOP
    -- Generate random 4-char suffix
    random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || user_id::TEXT), 1, 4));
    new_code := name_prefix || random_suffix;
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = new_code) INTO code_exists;
    
    -- If code is unique, exit loop
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 5: Generate codes for existing affiliates
-- ========================================

-- Generate codes for all existing affiliates who don't have one
UPDATE public.users
SET referral_code = generate_referral_code_flexible(id, email)
WHERE current_role = 'affiliate' 
AND referral_code IS NULL;

-- ========================================
-- STEP 6: Auto-generate trigger
-- ========================================

CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for affiliates without a code
  IF NEW.current_role = 'affiliate' AND NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code_flexible(NEW.id, NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_referral_code ON public.users;

CREATE TRIGGER trigger_auto_generate_referral_code
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION auto_generate_referral_code();

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check that referral codes were generated
SELECT 
    current_role,
    COUNT(*) as total_users,
    COUNT(referral_code) as users_with_code
FROM users
WHERE current_role = 'affiliate'
GROUP BY current_role;

-- Check tables were created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('affiliate_referrals', 'referral_commissions')
ORDER BY table_name;

-- Check RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('affiliate_referrals', 'referral_commissions')
ORDER BY tablename;

-- Sample referral codes (using email instead of full_name)
SELECT 
    id,
    email,
    referral_code,
    current_role
FROM users
WHERE current_role = 'affiliate'
AND referral_code IS NOT NULL
LIMIT 10;

-- Test the function manually (optional)
-- SELECT generate_referral_code_flexible(1, 'john.smith@example.com');
-- Expected output: Something like 'JOHN4X9Z'
