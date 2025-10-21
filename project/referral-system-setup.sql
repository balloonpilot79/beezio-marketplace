-- =====================================================
-- REFERRAL COMMISSION SYSTEM DATABASE SCHEMA
-- =====================================================
-- Track who referred whom and calculate multi-tier commissions
-- User → Refers Affiliate → Affiliate Makes Sale → Referrer Earns 2-5%

-- =====================================================
-- 1. REFERRALS TABLE
-- =====================================================
-- Tracks referral relationships between users
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User who was referred
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- User who referred them
    referred_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Referral code used during signup
    referral_code TEXT NOT NULL,
    
    -- Commission rate for referrer (2-5%)
    referral_commission_rate DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    CHECK (referral_commission_rate >= 2.00 AND referral_commission_rate <= 5.00),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Lifetime earnings for referrer from this user
    total_earnings DECIMAL(10,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id), -- Each user can only be referred once
    CHECK (user_id != referred_by_id) -- Can't refer yourself
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_by_id ON referrals(referred_by_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_active ON referrals(is_active) WHERE is_active = true;

-- =====================================================
-- 2. REFERRAL EARNINGS TABLE
-- =====================================================
-- Track individual referral commission payments
CREATE TABLE IF NOT EXISTS referral_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referral relationship
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    
    -- Transaction that generated this earning
    order_id UUID NOT NULL,
    
    -- Earnings breakdown
    sale_amount DECIMAL(10,2) NOT NULL,           -- Total sale amount
    affiliate_commission DECIMAL(10,2) NOT NULL,  -- What affiliate earned
    referral_commission DECIMAL(10,2) NOT NULL,   -- What referrer earned (2-5% of sale)
    referral_rate DECIMAL(5,2) NOT NULL,          -- Rate used for this earning
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    paid_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referral_id ON referral_earnings(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_order_id ON referral_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_status ON referral_earnings(status);

-- =====================================================
-- 3. PLATFORM SETTINGS TABLE
-- =====================================================
-- Store configurable platform fees
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Insert default platform fee settings
INSERT INTO platform_settings (setting_key, setting_value, description)
VALUES 
    ('platform_fee_percentage', '10.00', 'Beezio platform fee percentage (10-15%)'),
    ('default_referral_rate', '3.00', 'Default referral commission rate (2-5%)'),
    ('stripe_fee_percentage', '2.90', 'Stripe processing fee percentage'),
    ('stripe_fee_fixed', '0.60', 'Stripe fixed fee per transaction')
ON CONFLICT (setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- =====================================================
-- 4. UPDATE PROFILES TABLE
-- =====================================================
-- Add referral code to user profiles
DO $$ 
BEGIN
    -- Add referral_code column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'referral_code'
    ) THEN
        ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE;
    END IF;
    
    -- Add referral earnings tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'total_referral_earnings'
    ) THEN
        ALTER TABLE profiles ADD COLUMN total_referral_earnings DECIMAL(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Generate unique referral codes for existing users without one
UPDATE profiles 
SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- Index for referral code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- =====================================================
-- 5. FUNCTIONS
-- =====================================================

-- Function to get platform setting
CREATE OR REPLACE FUNCTION get_platform_setting(key TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    SELECT setting_value INTO result
    FROM platform_settings
    WHERE setting_key = key;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
        
        -- Check if code already exists
        SELECT EXISTS(
            SELECT 1 FROM profiles WHERE referral_code = new_code
        ) INTO code_exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to record referral commission
CREATE OR REPLACE FUNCTION record_referral_commission(
    p_order_id UUID,
    p_sale_amount DECIMAL,
    p_affiliate_commission DECIMAL,
    p_seller_id UUID
)
RETURNS void AS $$
DECLARE
    v_referral referrals%ROWTYPE;
    v_referral_commission DECIMAL;
BEGIN
    -- Check if seller was referred by someone
    SELECT * INTO v_referral
    FROM referrals
    WHERE user_id = p_seller_id
    AND is_active = true;
    
    -- If referral exists, record commission
    IF FOUND THEN
        -- Calculate referral commission (percentage of total sale)
        v_referral_commission := p_sale_amount * (v_referral.referral_commission_rate / 100);
        
        -- Insert earning record
        INSERT INTO referral_earnings (
            referral_id,
            order_id,
            sale_amount,
            affiliate_commission,
            referral_commission,
            referral_rate
        ) VALUES (
            v_referral.id,
            p_order_id,
            p_sale_amount,
            p_affiliate_commission,
            v_referral_commission,
            v_referral.referral_commission_rate
        );
        
        -- Update total earnings for referral
        UPDATE referrals
        SET total_earnings = total_earnings + v_referral_commission,
            updated_at = NOW()
        WHERE id = v_referral.id;
        
        -- Update referrer's profile
        UPDATE profiles
        SET total_referral_earnings = total_referral_earnings + v_referral_commission
        WHERE id = v_referral.referred_by_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. AUTO-UPDATE TRIGGERS
-- =====================================================

-- Trigger to auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at
    BEFORE UPDATE ON referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_referral_earnings_updated_at ON referral_earnings;
CREATE TRIGGER update_referral_earnings_updated_at
    BEFORE UPDATE ON referral_earnings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER update_platform_settings_updated_at
    BEFORE UPDATE ON platform_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 7. VIEWS
-- =====================================================

-- Referral dashboard view
CREATE OR REPLACE VIEW referral_dashboard AS
SELECT 
    r.id,
    r.user_id,
    r.referred_by_id,
    r.referral_code,
    r.referral_commission_rate,
    r.total_earnings,
    r.is_active,
    r.created_at,
    
    -- Referred user info
    up.full_name as referred_user_name,
    up.email as referred_user_email,
    
    -- Referrer info
    rp.full_name as referrer_name,
    rp.email as referrer_email,
    
    -- Earnings count
    (SELECT COUNT(*) FROM referral_earnings WHERE referral_id = r.id) as total_commissions,
    (SELECT COUNT(*) FROM referral_earnings WHERE referral_id = r.id AND status = 'paid') as paid_commissions
FROM referrals r
LEFT JOIN profiles up ON r.user_id = up.id
LEFT JOIN profiles rp ON r.referred_by_id = rp.id;

-- =====================================================
-- 8. PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT ALL ON referrals TO authenticated;
GRANT ALL ON referral_earnings TO authenticated;
GRANT SELECT ON platform_settings TO authenticated;
GRANT UPDATE ON platform_settings TO authenticated; -- Admins only in app layer
GRANT ALL ON referral_dashboard TO authenticated;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- Tables created:
--   - referrals: Track who referred whom
--   - referral_earnings: Individual commission payments
--   - platform_settings: Configurable fees (10-15% Beezio, 2-5% referral)
-- 
-- Profiles updated:
--   - referral_code: Unique 8-char code for each user
--   - total_referral_earnings: Lifetime earnings from referrals
--
-- Functions:
--   - generate_referral_code(): Create unique codes
--   - get_platform_setting(key): Get config values
--   - record_referral_commission(): Track earnings
--
-- Next steps:
--   1. Update pricing.ts to include referral tier
--   2. Update PricingCalculator to show referral commission
--   3. Create referral signup flow
--   4. Create referral dashboard UI
-- =====================================================
