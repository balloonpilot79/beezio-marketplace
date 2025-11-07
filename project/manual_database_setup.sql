-- Run these SQL commands directly in Supabase SQL Editor
-- Go to: https://supabase.com/dashboard → Your Project → SQL Editor

-- 1. Add affiliate_enabled column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS affiliate_enabled BOOLEAN DEFAULT true;

-- 2. Add sku column to products table  
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);

-- 3. Update existing products to have affiliate enabled by default
UPDATE products SET affiliate_enabled = true WHERE affiliate_enabled IS NULL;

-- 4. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_products_affiliate_enabled ON products(affiliate_enabled);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 5. Add referral_code to profiles if it doesn't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE;

-- 5.5. Drop existing referral tables if they exist (clean slate)
DROP TABLE IF EXISTS referral_commissions CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;

-- 6. Create referrals table for 5% commission system
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referee_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL,
  signup_date TIMESTAMPTZ DEFAULT NOW(),
  total_commissions_earned DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referee_profile_id)
);

-- 7. Create referral_commissions table
CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
  order_id UUID,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  sale_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) DEFAULT 5.00,
  commission_amount DECIMAL(10,2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable RLS on new tables
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;

-- 10. Generate referral codes for existing users
CREATE OR REPLACE FUNCTION generate_referral_code_simple(user_email TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN UPPER(LEFT(SPLIT_PART(user_email, '@', 1), 4)) || 
         LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update existing profiles with referral codes
UPDATE profiles 
SET referral_code = generate_referral_code_simple(email)
WHERE referral_code IS NULL AND email IS NOT NULL;

-- 11. Add RLS policies (after tables are created) - simplified for now
CREATE POLICY "referrals_select_policy" ON referrals FOR SELECT USING (true);
CREATE POLICY "referrals_insert_policy" ON referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "referral_commissions_select_policy" ON referral_commissions FOR SELECT USING (true);

-- Done! All tables and columns should now be ready.