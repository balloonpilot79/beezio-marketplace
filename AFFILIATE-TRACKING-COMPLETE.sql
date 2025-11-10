-- AFFILIATE MARKETING & COMMISSION TRACKING SYSTEM
-- Copy ALL of this and run in Supabase SQL Editor

-- 1. Add affiliate tracking columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES profiles(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_commission DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_payout DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50);

-- 2. Create affiliate_links table for tracking product-specific links
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

-- 3. Create affiliate_earnings table for tracking payouts
CREATE TABLE IF NOT EXISTS affiliate_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create link_clicks table for analytics
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id UUID REFERENCES affiliate_links(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  referrer TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS on new tables
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for affiliate_links
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

-- 7. RLS Policies for affiliate_earnings
DROP POLICY IF EXISTS "Affiliates can view their earnings" ON affiliate_earnings;
CREATE POLICY "Affiliates can view their earnings" ON affiliate_earnings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can view earnings" ON affiliate_earnings;
CREATE POLICY "Public can view earnings" ON affiliate_earnings
  FOR SELECT USING (true);

-- 8. RLS Policies for link_clicks
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

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate ON affiliate_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_product ON affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_code ON affiliate_links(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_affiliate ON affiliate_earnings(affiliate_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_order ON affiliate_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON link_clicks(affiliate_link_id);
CREATE INDEX IF NOT EXISTS idx_orders_affiliate ON orders(affiliate_id);

-- 10. Create function to auto-generate affiliate links when product is added
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

-- 11. Create trigger to auto-generate links
DROP TRIGGER IF EXISTS auto_create_affiliate_link ON affiliate_products;
CREATE TRIGGER auto_create_affiliate_link
  AFTER INSERT ON affiliate_products
  FOR EACH ROW
  EXECUTE FUNCTION create_affiliate_link_on_product_add();

-- 12. Create function to record earnings when order is placed
CREATE OR REPLACE FUNCTION record_affiliate_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record if there's an affiliate
  IF NEW.affiliate_id IS NOT NULL AND NEW.affiliate_commission > 0 THEN
    INSERT INTO affiliate_earnings (affiliate_id, order_id, amount, status)
    VALUES (NEW.affiliate_id, NEW.id, NEW.affiliate_commission, 'pending');
    
    -- Update affiliate link stats if referral_code exists
    IF NEW.referral_code IS NOT NULL THEN
      UPDATE affiliate_links
      SET 
        conversions = conversions + 1,
        total_commission = total_commission + NEW.affiliate_commission
      WHERE referral_code = NEW.referral_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 13. Create trigger to auto-record earnings
DROP TRIGGER IF EXISTS auto_record_affiliate_earnings ON orders;
CREATE TRIGGER auto_record_affiliate_earnings
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_affiliate_earnings();

-- SUCCESS! Affiliate tracking system is ready!
-- Now affiliates can:
-- ✅ Get unique links for each product
-- ✅ Track clicks and conversions
-- ✅ See their earnings
-- ✅ Request payouts
