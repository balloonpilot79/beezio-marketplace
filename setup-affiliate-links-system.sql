-- Add promotion_method field to affiliate_store_settings
ALTER TABLE affiliate_store_settings 
ADD COLUMN IF NOT EXISTS promotion_method TEXT DEFAULT 'store' CHECK (promotion_method IN ('store', 'links'));

-- Add store_enabled flag
ALTER TABLE affiliate_store_settings 
ADD COLUMN IF NOT EXISTS store_enabled BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN affiliate_store_settings.promotion_method IS 'How affiliate promotes: store (full storefront) or links (just affiliate links/QR codes)';
COMMENT ON COLUMN affiliate_store_settings.store_enabled IS 'Whether the affiliate has enabled their public store';

-- Drop table if it exists to recreate cleanly
DROP TABLE IF EXISTS affiliate_links CASCADE;

-- Create affiliate_links table for tracking custom links and QR codes
CREATE TABLE affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  link_code TEXT UNIQUE NOT NULL,
  custom_name TEXT,
  link_url TEXT NOT NULL,
  qr_code_data TEXT,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_clicked_at TIMESTAMPTZ
);

-- Add RLS policies for affiliate_links
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own links
CREATE POLICY "Affiliates can view own links" ON affiliate_links
  FOR SELECT USING (auth.uid() = affiliate_id);

-- Affiliates can create their own links
CREATE POLICY "Affiliates can create own links" ON affiliate_links
  FOR INSERT WITH CHECK (auth.uid() = affiliate_id);

-- Affiliates can update their own links
CREATE POLICY "Affiliates can update own links" ON affiliate_links
  FOR UPDATE USING (auth.uid() = affiliate_id);

-- Affiliates can delete their own links
CREATE POLICY "Affiliates can delete own links" ON affiliate_links
  FOR DELETE USING (auth.uid() = affiliate_id);

-- Create indexes for performance
CREATE INDEX idx_affiliate_links_affiliate ON affiliate_links(affiliate_id);
CREATE INDEX idx_affiliate_links_product ON affiliate_links(product_id);
CREATE INDEX idx_affiliate_links_code ON affiliate_links(link_code);
CREATE INDEX idx_affiliate_links_active ON affiliate_links(is_active) WHERE is_active = true;

-- Function to generate unique link code
CREATE OR REPLACE FUNCTION generate_affiliate_link_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE affiliate_links IS 'Tracks affiliate promotional links and QR codes for commission tracking';
