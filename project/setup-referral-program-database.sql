-- Affiliate Referral Program - Database Setup
-- Run this in Supabase SQL Editor

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
  referrer_id BIGINT NOT NULL, -- Affiliate who referred (references users.id)
  referred_id BIGINT NOT NULL UNIQUE, -- New affiliate who was referred
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, inactive
  total_sales DECIMAL(10,2) DEFAULT 0, -- Track total sales by referred affiliate
  total_commission DECIMAL(10,2) DEFAULT 0, -- Track total 2% earned
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_referrer FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_referred FOREIGN KEY (referred_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT unique_referred UNIQUE(referred_id) -- Each affiliate can only be referred once
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
  referrer_id BIGINT NOT NULL, -- Affiliate earning the 2%
  referred_affiliate_id BIGINT NOT NULL, -- Affiliate who made the sale
  order_id BIGINT NOT NULL, -- Order that generated commission
  order_item_id UUID, -- Specific item in order
  sale_amount DECIMAL(10,2) NOT NULL, -- Total transaction amount
  commission_amount DECIMAL(10,2) NOT NULL, -- 2% of sale_amount
  commission_rate DECIMAL(5,2) DEFAULT 2.00, -- 2% referral rate
  status TEXT DEFAULT 'pending', -- pending, paid, cancelled
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
-- STEP 4: Generate referral codes for existing affiliates
-- ========================================

-- Function to generate referral code
CREATE OR REPLACE FUNCTION generate_referral_code(user_id BIGINT, full_name TEXT)
RETURNS TEXT AS $$
DECLARE
  name_prefix TEXT;
  random_suffix TEXT;
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Get first 4 letters of first name
  name_prefix := UPPER(SUBSTRING(SPLIT_PART(full_name, ' ', 1), 1, 4));
  
  -- Loop until we find a unique code
  LOOP
    -- Generate random 4-char suffix
    random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));
    new_code := name_prefix || random_suffix;
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = new_code) INTO code_exists;
    
    -- If code is unique, exit loop
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Generate codes for all existing affiliates who don't have one
UPDATE public.users
SET referral_code = generate_referral_code(id, full_name)
WHERE current_role = 'affiliate' 
AND referral_code IS NULL;

-- ========================================
-- STEP 5: Add trigger to auto-generate code for new affiliates
-- ========================================

CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for affiliates without a code
  IF NEW.current_role = 'affiliate' AND NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.id, NEW.full_name);
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
-- STEP 6: Create helper views
-- ========================================

-- View: Referral earnings summary for each affiliate
CREATE OR REPLACE VIEW referral_earnings_summary AS
SELECT 
    ar.referrer_id,
    u.full_name as referrer_name,
    COUNT(DISTINCT ar.referred_id) as total_referrals,
    SUM(rc.commission_amount) as total_earned,
    SUM(CASE WHEN rc.status = 'pending' THEN rc.commission_amount ELSE 0 END) as pending_earnings,
    SUM(CASE WHEN rc.status = 'paid' THEN rc.commission_amount ELSE 0 END) as paid_earnings
FROM affiliate_referrals ar
LEFT JOIN referral_commissions rc ON rc.referrer_id = ar.referrer_id
LEFT JOIN users u ON u.id = ar.referrer_id
GROUP BY ar.referrer_id, u.full_name;

-- View: Top referrers leaderboard
CREATE OR REPLACE VIEW top_referrers AS
SELECT 
    u.id,
    u.full_name,
    u.referral_code,
    COUNT(DISTINCT ar.referred_id) as referral_count,
    COALESCE(SUM(rc.commission_amount), 0) as total_earnings
FROM users u
LEFT JOIN affiliate_referrals ar ON ar.referrer_id = u.id
LEFT JOIN referral_commissions rc ON rc.referrer_id = u.id
WHERE u.current_role = 'affiliate'
GROUP BY u.id, u.full_name, u.referral_code
ORDER BY referral_count DESC, total_earnings DESC
LIMIT 10;

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

-- Sample referral codes
SELECT 
    id,
    full_name,
    email,
    referral_code,
    current_role
FROM users
WHERE current_role = 'affiliate'
AND referral_code IS NOT NULL
LIMIT 10;
