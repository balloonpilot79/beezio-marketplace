-- CLEAN AFFILIATE TRACKING SETUP
-- This removes any problematic triggers first, then creates everything fresh
-- Copy ALL of this and run in Supabase SQL Editor

-- Step 1: Remove any existing problematic triggers
-- =====================================================================
DROP TRIGGER IF EXISTS auto_record_affiliate_earnings ON orders;
DROP FUNCTION IF EXISTS record_affiliate_earnings();

-- Step 2: Create the new tables (no dependencies on orders table)
-- =====================================================================

-- Create affiliate_links table for tracking product-specific links
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) UNIQUE NOT NULL,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_commission DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(affiliate_id, product_id)
);

-- Create affiliate_earnings table for tracking payouts
CREATE TABLE IF NOT EXISTS affiliate_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create link_clicks table for analytics
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id UUID REFERENCES affiliate_links(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Enable RLS on new tables
-- =====================================================================
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- Step 4: Add RLS Policies
-- =====================================================================

-- RLS Policies for affiliate_links
DROP POLICY IF EXISTS "Affiliates can view their own links" ON affiliate_links;
CREATE POLICY "Affiliates can view their own links" ON affiliate_links
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Affiliates can manage their links" ON affiliate_links;
CREATE POLICY "Affiliates can manage their links" ON affiliate_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can view link stats" ON affiliate_links;
CREATE POLICY "Public can view link stats" ON affiliate_links
  FOR SELECT USING (true);

-- RLS Policies for affiliate_earnings
DROP POLICY IF EXISTS "Affiliates can view their earnings" ON affiliate_earnings;
CREATE POLICY "Affiliates can view their earnings" ON affiliate_earnings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can view earnings" ON affiliate_earnings;
CREATE POLICY "Public can view earnings" ON affiliate_earnings
  FOR SELECT USING (true);

-- RLS Policies for link_clicks
DROP POLICY IF EXISTS "Anyone can insert clicks" ON link_clicks;
CREATE POLICY "Anyone can insert clicks" ON link_clicks
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Affiliates can view their clicks" ON link_clicks;
CREATE POLICY "Affiliates can view their clicks" ON link_clicks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM affiliate_links al
      JOIN profiles p ON p.id = al.affiliate_id
      WHERE al.id = link_clicks.affiliate_link_id AND p.user_id = auth.uid()
    )
  );

-- Step 5: Create indexes for performance
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate ON affiliate_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_product ON affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_affiliate ON affiliate_earnings(affiliate_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_order ON affiliate_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON link_clicks(affiliate_link_id);

-- Step 6: Create function to auto-generate affiliate links when product is added
-- =====================================================================
CREATE OR REPLACE FUNCTION create_affiliate_link_on_product_add()
RETURNS TRIGGER AS $$
DECLARE
  ref_code VARCHAR(50);
BEGIN
  -- Generate referral code: AFF-{first 8 of affiliate_id}-{first 8 of product_id}
  ref_code := 'AFF-' || SUBSTRING(NEW.affiliate_id::text, 1, 8) || '-' || SUBSTRING(NEW.product_id::text, 1, 8);
  
  -- Insert affiliate link if it doesn't exist
  INSERT INTO affiliate_links (affiliate_id, product_id, referral_code)
  VALUES (NEW.affiliate_id, NEW.product_id, ref_code)
  ON CONFLICT (affiliate_id, product_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate links
DROP TRIGGER IF EXISTS auto_create_affiliate_link ON affiliate_products;
CREATE TRIGGER auto_create_affiliate_link
  AFTER INSERT ON affiliate_products
  FOR EACH ROW
  EXECUTE FUNCTION create_affiliate_link_on_product_add();

-- SUCCESS! 
-- =====================================================================
-- Affiliate link tracking system is ready!
-- 
-- ✅ Affiliates can now get unique links for each product
-- ✅ Links auto-generate when they add products to their store
-- ✅ Click tracking ready
-- ✅ Earnings tracking ready
-- 
-- NEXT STEPS:
-- After this succeeds, run AFFILIATE-ORDERS-COLUMNS.sql to add tracking to orders table
