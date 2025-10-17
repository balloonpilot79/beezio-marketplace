-- Affiliate Referral Program Database Schema
-- This enables affiliates to recruit other affiliates and earn 2% override commission

-- ========================================
-- 1. AFFILIATE_REFERRALS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_affiliate_id BIGINT NOT NULL, -- Affiliate who referred
  referred_affiliate_id BIGINT NOT NULL, -- Affiliate who was referred
  referral_code TEXT NOT NULL, -- The code that was used
  status TEXT DEFAULT 'active', -- active, inactive
  total_override_earned DECIMAL(10,2) DEFAULT 0, -- Total earned from this referral
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(referred_affiliate_id), -- Each affiliate can only be referred once
  FOREIGN KEY (referrer_affiliate_id) REFERENCES public.users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_affiliate_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- ========================================
-- 2. AFFILIATE_REFERRAL_CODES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.affiliate_referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id BIGINT NOT NULL,
  code TEXT NOT NULL UNIQUE, -- e.g., "JASON2025", "MIKE-REF"
  is_active BOOLEAN DEFAULT true,
  uses_count INTEGER DEFAULT 0, -- Track how many times used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  FOREIGN KEY (affiliate_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- ========================================
-- 3. AFFILIATE_OVERRIDE_COMMISSIONS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.affiliate_override_commissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_affiliate_id BIGINT NOT NULL, -- Who gets the override
  referred_affiliate_id BIGINT NOT NULL, -- Who made the sale
  order_id UUID NOT NULL,
  order_item_id UUID,
  override_amount DECIMAL(10,2) NOT NULL, -- 2% of the platform fee
  platform_fee_reduced DECIMAL(10,2) NOT NULL, -- Beezio keeps 8% instead of 10%
  status TEXT DEFAULT 'pending', -- pending, paid
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  FOREIGN KEY (referrer_affiliate_id) REFERENCES public.users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_affiliate_id) REFERENCES public.users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
);

-- ========================================
-- 4. ADD REFERRED_BY COLUMN TO USERS TABLE
-- ========================================
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS referred_by_affiliate_id BIGINT,
ADD COLUMN IF NOT EXISTS referral_code_used TEXT;

-- Add foreign key
ALTER TABLE public.users
ADD CONSTRAINT fk_users_referred_by 
FOREIGN KEY (referred_by_affiliate_id) 
REFERENCES public.users(id) 
ON DELETE SET NULL;

-- ========================================
-- 5. ENABLE RLS ON NEW TABLES
-- ========================================

-- Affiliate Referrals
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view their own referrals" ON public.affiliate_referrals;
DROP POLICY IF EXISTS "Affiliates can view referrals they made" ON public.affiliate_referrals;

CREATE POLICY "Affiliates can view their own referrals"
ON public.affiliate_referrals FOR SELECT TO authenticated
USING (referrer_affiliate_id::text = auth.uid()::text OR referred_affiliate_id::text = auth.uid()::text);

-- Affiliate Referral Codes
ALTER TABLE public.affiliate_referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view their own codes" ON public.affiliate_referral_codes;
DROP POLICY IF EXISTS "Affiliates can create their own codes" ON public.affiliate_referral_codes;
DROP POLICY IF EXISTS "Anyone can view active codes for signup" ON public.affiliate_referral_codes;

CREATE POLICY "Affiliates can view their own codes"
ON public.affiliate_referral_codes FOR SELECT TO authenticated
USING (affiliate_id::text = auth.uid()::text);

CREATE POLICY "Affiliates can create their own codes"
ON public.affiliate_referral_codes FOR INSERT TO authenticated
WITH CHECK (affiliate_id::text = auth.uid()::text);

CREATE POLICY "Anyone can view active codes for signup"
ON public.affiliate_referral_codes FOR SELECT TO anon, authenticated
USING (is_active = true);

-- Affiliate Override Commissions
ALTER TABLE public.affiliate_override_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view their override commissions" ON public.affiliate_override_commissions;

CREATE POLICY "Affiliates can view their override commissions"
ON public.affiliate_override_commissions FOR SELECT TO authenticated
USING (referrer_affiliate_id::text = auth.uid()::text);

-- ========================================
-- 6. INDEXES FOR PERFORMANCE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referrer ON public.affiliate_referrals(referrer_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred ON public.affiliate_referrals(referred_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referral_codes_affiliate ON public.affiliate_referral_codes(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referral_codes_code ON public.affiliate_referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_affiliate_override_commissions_referrer ON public.affiliate_override_commissions(referrer_affiliate_id);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by_affiliate_id);

-- ========================================
-- 7. FUNCTION TO GENERATE UNIQUE REFERRAL CODE
-- ========================================
CREATE OR REPLACE FUNCTION generate_referral_code(user_name TEXT, user_id BIGINT)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create base code from name (first 6 chars, uppercase, alphanumeric only)
  base_code := UPPER(REGEXP_REPLACE(SUBSTRING(user_name, 1, 6), '[^A-Z0-9]', '', 'g'));
  
  -- If too short, pad with user ID
  IF LENGTH(base_code) < 4 THEN
    base_code := base_code || SUBSTRING(user_id::TEXT, 1, 4);
  END IF;
  
  -- Try to find unique code
  final_code := base_code;
  WHILE EXISTS (SELECT 1 FROM public.affiliate_referral_codes WHERE code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter::TEXT;
  END LOOP;
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. FUNCTION TO AUTO-CREATE REFERRAL CODE ON AFFILIATE SIGNUP
-- ========================================
CREATE OR REPLACE FUNCTION create_default_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
BEGIN
  -- Only create for affiliates
  IF NEW.current_role = 'affiliate' THEN
    -- Generate unique code
    new_code := generate_referral_code(NEW.full_name, NEW.id);
    
    -- Insert the code
    INSERT INTO public.affiliate_referral_codes (affiliate_id, code, is_active)
    VALUES (NEW.id, new_code, true);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_referral_code ON public.users;
CREATE TRIGGER trigger_create_referral_code
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION create_default_referral_code();

-- ========================================
-- 9. VERIFICATION QUERIES
-- ========================================

-- Check all tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('affiliate_referrals', 'affiliate_referral_codes', 'affiliate_override_commissions')
ORDER BY table_name;

-- Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('affiliate_referrals', 'affiliate_referral_codes', 'affiliate_override_commissions')
ORDER BY tablename;

-- Count policies
SELECT tablename, COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('affiliate_referrals', 'affiliate_referral_codes', 'affiliate_override_commissions')
GROUP BY tablename
ORDER BY tablename;
