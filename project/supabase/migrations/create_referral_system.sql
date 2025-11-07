-- Referral System - 5% passive income for referrers
-- This table tracks who referred whom and calculates commissions

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referrer (person who shared the code)
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Referee (person who signed up with the code)
  referee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Referral tracking
  referral_code VARCHAR(50) NOT NULL,
  signup_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Commission tracking
  total_commissions_earned DECIMAL(10,2) DEFAULT 0,
  last_commission_date TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(referee_id), -- Each user can only be referred once
  CHECK(referrer_id != referee_id) -- Can't refer yourself
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- Table to track individual commission payments from referrals
CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Links to referral relationship
  referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
  
  -- Transaction that generated the commission
  order_id UUID, -- References orders table
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Commission details
  sale_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 5.00, -- 5% default
  commission_amount DECIMAL(10,2) NOT NULL,
  
  -- Payment tracking
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  paid_date TIMESTAMPTZ,
  stripe_transfer_id VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CHECK(commission_amount = (sale_amount * commission_rate / 100))
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referral ON referral_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions(payment_status);

-- Function to generate unique referral codes
CREATE OR REPLACE FUNCTION generate_referral_code(user_email TEXT)
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  counter INTEGER := 0;
BEGIN
  -- Create base code from email + random
  code := UPPER(LEFT(SPLIT_PART(user_email, '@', 1), 4)) || 
          LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  
  -- Ensure uniqueness
  WHILE EXISTS(SELECT 1 FROM referrals WHERE referral_code = code) LOOP
    counter := counter + 1;
    code := UPPER(LEFT(SPLIT_PART(user_email, '@', 1), 4)) || 
            LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Prevent infinite loop
    IF counter > 100 THEN
      code := 'REF' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
      EXIT;
    END IF;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Add referral_code column to profiles table for easy access
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE;

-- Function to auto-generate referral code for new profiles
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate referral code if not provided
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code(NEW.email);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral codes
DROP TRIGGER IF EXISTS trigger_auto_referral_code ON profiles;
CREATE TRIGGER trigger_auto_referral_code
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_referral_code();

-- RLS Policies for referrals table
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can see their own referral relationships
CREATE POLICY "Users can view their referrals" ON referrals
  FOR SELECT USING (
    auth.uid() = referrer_id OR 
    auth.uid() = referee_id
  );

-- Users can create referral relationships when signing up
CREATE POLICY "Users can create referrals" ON referrals
  FOR INSERT WITH CHECK (
    auth.uid() = referee_id
  );

-- RLS Policies for referral_commissions table  
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;

-- Users can see their own commission earnings
CREATE POLICY "Users can view their referral commissions" ON referral_commissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM referrals 
      WHERE referrals.id = referral_commissions.referral_id 
      AND referrals.referrer_id = auth.uid()
    )
  );

-- Comment on tables
COMMENT ON TABLE referrals IS 'Tracks referral relationships between users for passive income system';
COMMENT ON TABLE referral_commissions IS 'Individual commission payments from referral sales (5% of each sale)';
COMMENT ON COLUMN referrals.referral_code IS 'Unique code that referrers share to earn 5% commission';
COMMENT ON COLUMN referral_commissions.commission_rate IS 'Percentage commission rate (default 5%)';

-- Sample function to process referral commission (called when order is completed)
CREATE OR REPLACE FUNCTION process_referral_commission(
  p_order_id UUID,
  p_buyer_id UUID,
  p_sale_amount DECIMAL
)
RETURNS VOID AS $$
DECLARE
  referral_record referrals%ROWTYPE;
  commission_amount DECIMAL;
BEGIN
  -- Check if buyer was referred by someone
  SELECT * INTO referral_record
  FROM referrals 
  WHERE referee_id = p_buyer_id 
  AND status = 'active';
  
  -- If referral exists, create commission record
  IF FOUND THEN
    commission_amount := p_sale_amount * 0.05; -- 5%
    
    -- Insert commission record
    INSERT INTO referral_commissions (
      referral_id,
      order_id,
      sale_amount,
      commission_rate,
      commission_amount
    ) VALUES (
      referral_record.id,
      p_order_id,
      p_sale_amount,
      5.00,
      commission_amount
    );
    
    -- Update total commissions for referrer
    UPDATE referrals 
    SET 
      total_commissions_earned = total_commissions_earned + commission_amount,
      last_commission_date = NOW(),
      updated_at = NOW()
    WHERE id = referral_record.id;
    
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update existing profiles to have referral codes
UPDATE profiles 
SET referral_code = generate_referral_code(email)
WHERE referral_code IS NULL;

COMMENT ON FUNCTION process_referral_commission IS 'Processes 5% referral commission when referred user makes a purchase';