-- SIMPLIFIED VERSION - Run this if the main SQL keeps failing
-- This skips adding columns to existing tables and just creates new tables

-- 1. Add custom pages table for sellers and affiliates
CREATE TABLE IF NOT EXISTS custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('seller', 'affiliate')),
  page_slug VARCHAR(100) NOT NULL,
  page_title VARCHAR(200) NOT NULL,
  page_content TEXT, -- HTML content
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, page_slug)
);

-- 2. Add product display order for sellers
CREATE TABLE IF NOT EXISTS seller_product_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id, product_id)
);

-- 3. Add affiliate product selections
CREATE TABLE IF NOT EXISTS affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(affiliate_id, product_id)
);

-- 4. Add affiliate_store_settings table
CREATE TABLE IF NOT EXISTS affiliate_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  store_name VARCHAR(200),
  description TEXT,
  banner_url TEXT,
  logo_url TEXT,
  theme VARCHAR(50) DEFAULT 'modern',
  theme_settings JSONB DEFAULT '{
    "primary_color": "#ffcc00",
    "secondary_color": "#000000",
    "font_family": "Poppins",
    "layout": "grid"
  }'::jsonb,
  social_links JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS on new tables
ALTER TABLE custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_product_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_store_settings ENABLE ROW LEVEL SECURITY;

-- 6. Drop and recreate policies for custom_pages
DROP POLICY IF EXISTS "Users can view their own pages" ON custom_pages;
DROP POLICY IF EXISTS "Public can view active pages" ON custom_pages;
DROP POLICY IF EXISTS "Users can manage their own pages" ON custom_pages;

CREATE POLICY "Users can view their own pages" ON custom_pages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = owner_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view active pages" ON custom_pages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage their own pages" ON custom_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = owner_id AND profiles.user_id = auth.uid())
  );

-- 7. Drop and recreate policies for seller_product_order
DROP POLICY IF EXISTS "Sellers can manage their product order" ON seller_product_order;
DROP POLICY IF EXISTS "Public can view product order" ON seller_product_order;

CREATE POLICY "Sellers can manage their product order" ON seller_product_order
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = seller_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view product order" ON seller_product_order
  FOR SELECT USING (true);

-- 8. Drop and recreate policies for affiliate_products
DROP POLICY IF EXISTS "Affiliates can manage their products" ON affiliate_products;
DROP POLICY IF EXISTS "Public can view affiliate products" ON affiliate_products;

CREATE POLICY "Affiliates can manage their products" ON affiliate_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view affiliate products" ON affiliate_products
  FOR SELECT USING (true);

-- 9. Drop and recreate policies for affiliate_store_settings
DROP POLICY IF EXISTS "Affiliates can manage their store settings" ON affiliate_store_settings;
DROP POLICY IF EXISTS "Public can view affiliate store settings" ON affiliate_store_settings;

CREATE POLICY "Affiliates can manage their store settings" ON affiliate_store_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view affiliate store settings" ON affiliate_store_settings
  FOR SELECT USING (true);

-- 10. Create indexes
CREATE INDEX IF NOT EXISTS idx_custom_pages_owner ON custom_pages(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_custom_pages_slug ON custom_pages(page_slug);
CREATE INDEX IF NOT EXISTS idx_seller_product_order ON seller_product_order(seller_id, display_order);
CREATE INDEX IF NOT EXISTS idx_affiliate_products ON affiliate_products(affiliate_id, display_order);

-- Done! Core tables created. 
-- Note: You'll need to manually add display_order and theme_settings columns later if needed.
