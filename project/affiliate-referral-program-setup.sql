-- Affiliate Referral Program Database Setup
-- This creates a 2-tier affiliate system where affiliates can recruit other affiliates
-- Recruiter gets 2% of Beezio's 10% cut (leaving Beezio with 8%)

-- ========================================
-- 1. ADD REFERRAL COLUMNS TO USERS TABLE
-- ========================================

-- Add referral tracking columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by_affiliate_id BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_earnings DECIMAL(10,2) DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- ========================================
-- 2. CREATE AFFILIATE_REFERRALS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id BIGSERIAL PRIMARY KEY,
  recruiter_id BIGINT NOT NULL, -- The affiliate who referred someone
  recruited_id BIGINT NOT NULL, -- The new affiliate who signed up
  referral_code VARCHAR(20) NOT NULL,
  signup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'active', -- active, inactive
  total_earnings DECIMAL(10,2) DEFAULT 0, -- Total earnings from this referral
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_recruiter ON affiliate_referrals(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_recruited ON affiliate_referrals(recruited_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_code ON affiliate_referrals(referral_code);

-- Enable RLS
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Affiliates can view their own referrals" ON public.affiliate_referrals;
CREATE POLICY "Affiliates can view their own referrals"
ON public.affiliate_referrals FOR SELECT TO authenticated
USING (recruiter_id::text = auth.uid()::text OR recruited_id::text = auth.uid()::text);

-- ========================================
-- 3. CREATE REFERRAL_COMMISSIONS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id BIGSERIAL PRIMARY KEY,
  recruiter_id BIGINT NOT NULL, -- The affiliate who gets the 2%
  recruited_id BIGINT NOT NULL, -- The affiliate who made the sale
  order_id BIGINT NOT NULL,
  order_item_id BIGINT,
  original_sale_amount DECIMAL(10,2) NOT NULL, -- Product sale amount
  beezio_platform_fee DECIMAL(10,2) NOT NULL, -- Original 10% Beezio would get
  referral_commission DECIMAL(10,2) NOT NULL, -- 2% that recruiter gets
  beezio_net_fee DECIMAL(10,2) NOT NULL, -- 8% that Beezio keeps
  status VARCHAR(20) DEFAULT 'pending', -- pending, paid, cancelled
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_referral_commissions_recruiter ON referral_commissions(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_recruited ON referral_commissions(recruited_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_order ON referral_commissions(order_id);

-- Enable RLS
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Affiliates can view their own referral commissions" ON public.referral_commissions;
CREATE POLICY "Affiliates can view their own referral commissions"
ON public.referral_commissions FOR SELECT TO authenticated
USING (recruiter_id::text = auth.uid()::text);

-- ========================================
-- 4. CREATE FUNCTION TO GENERATE REFERRAL CODE
-- ========================================

CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check INTEGER;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code (uppercase)
    code := UPPER(substring(md5(random()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT COUNT(*) INTO exists_check 
    FROM users 
    WHERE referral_code = code;
    
    -- If code doesn't exist, return it
    IF exists_check = 0 THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. CREATE TRIGGER TO AUTO-GENERATE REFERRAL CODE
-- ========================================

CREATE OR REPLACE FUNCTION set_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set referral code for affiliates if they don't have one
  IF NEW.current_role = 'affiliate' AND (NEW.referral_code IS NULL OR NEW.referral_code = '') THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_referral_code ON users;
CREATE TRIGGER trigger_set_referral_code
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_referral_code();

-- ========================================
-- 6. CREATE FUNCTION TO CALCULATE REFERRAL COMMISSION
-- ========================================

CREATE OR REPLACE FUNCTION calculate_referral_commission(
  sale_amount DECIMAL,
  platform_fee DECIMAL
)
RETURNS TABLE (
  referral_commission DECIMAL,
  beezio_net_fee DECIMAL
) AS $$
BEGIN
  -- Referral commission is 2% of the platform fee (which is 10% of sale)
  -- This means 20% of the 10% fee goes to recruiter
  RETURN QUERY SELECT 
    ROUND(platform_fee * 0.20, 2) AS referral_commission,
    ROUND(platform_fee * 0.80, 2) AS beezio_net_fee;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. VERIFICATION QUERIES
-- ========================================

-- Check if columns were added
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('referred_by_affiliate_id', 'referral_code', 'referral_earnings')
ORDER BY column_name;

-- Check if tables were created
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = table_name
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (VALUES 
    ('affiliate_referrals'),
    ('referral_commissions')
) AS tables(table_name);

-- Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS ENABLED'
        ELSE '❌ RLS DISABLED'
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('affiliate_referrals', 'referral_commissions')
ORDER BY tablename;

-- Check if functions were created
SELECT 
    routine_name,
    '✅ CREATED' as status
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('generate_referral_code', 'set_referral_code', 'calculate_referral_commission')
ORDER BY routine_name;

-- Display sample referral code generation
SELECT generate_referral_code() as sample_referral_code;
