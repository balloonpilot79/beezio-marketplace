-- Add new columns to support the updated business model

-- Update profiles table to support seller preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seller_type VARCHAR(20) CHECK (seller_type IN ('independent', 'affiliate_enabled'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS passive_earnings DECIMAL(10,2) DEFAULT 0;

-- Update products table to reflect seller type
ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_type VARCHAR(20) CHECK (seller_type IN ('independent', 'affiliate_enabled')) DEFAULT 'affiliate_enabled';
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_for_affiliates BOOLEAN DEFAULT true;

-- Create referral earnings tracking
CREATE TABLE IF NOT EXISTS referral_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    earning_amount DECIMAL(10,2) NOT NULL,
    earning_percentage DECIMAL(5,2) DEFAULT 5.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create marketplace visibility rules
CREATE TABLE IF NOT EXISTS marketplace_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_visible_in_marketplace BOOLEAN DEFAULT true,
    affiliate_commission_rate DECIMAL(5,2) DEFAULT 20.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    
    UNIQUE(product_id)
);

-- Create affiliate product selections (when affiliates "accept" products)
CREATE TABLE IF NOT EXISTS affiliate_product_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    custom_link VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    added_to_store_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    
    UNIQUE(affiliate_id, product_id)
);

-- Generate referral codes for existing users
UPDATE profiles 
SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::text || id::text) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_referral_earnings_referrer ON referral_earnings(referrer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_products_visible ON marketplace_products(is_visible_in_marketplace);
CREATE INDEX IF NOT EXISTS idx_affiliate_selections_active ON affiliate_product_selections(affiliate_id, is_active);

-- RLS Policies
ALTER TABLE referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_product_selections ENABLE ROW LEVEL SECURITY;

-- Referral earnings policies
CREATE POLICY "Users can view their own referral earnings" ON referral_earnings
    FOR SELECT USING (referrer_id = auth.uid()::uuid);

CREATE POLICY "System can insert referral earnings" ON referral_earnings
    FOR INSERT WITH CHECK (true);

-- Marketplace products policies  
CREATE POLICY "Anyone can view marketplace products" ON marketplace_products
    FOR SELECT USING (is_visible_in_marketplace = true);

CREATE POLICY "Sellers can manage their marketplace products" ON marketplace_products
    FOR ALL USING (seller_id = auth.uid()::uuid);

-- Affiliate selections policies
CREATE POLICY "Affiliates can manage their product selections" ON affiliate_product_selections
    FOR ALL USING (affiliate_id = auth.uid()::uuid);

CREATE POLICY "Anyone can view active affiliate selections" ON affiliate_product_selections
    FOR SELECT USING (is_active = true);