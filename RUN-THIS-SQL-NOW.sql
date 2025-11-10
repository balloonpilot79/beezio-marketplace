-- STEP 1: Run this first to create new tables only
-- Copy and run this entire block

-- Create custom_pages table
CREATE TABLE IF NOT EXISTS custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('seller', 'affiliate')),
  page_slug VARCHAR(100) NOT NULL,
  page_title VARCHAR(200) NOT NULL,
  page_content TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, page_slug)
);

-- Create seller_product_order table
CREATE TABLE IF NOT EXISTS seller_product_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id, product_id)
);

-- Create affiliate_products table
CREATE TABLE IF NOT EXISTS affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(affiliate_id, product_id)
);

-- Create affiliate_store_settings table
CREATE TABLE IF NOT EXISTS affiliate_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  store_name VARCHAR(200),
  description TEXT,
  banner_url TEXT,
  logo_url TEXT,
  theme VARCHAR(50) DEFAULT 'modern',
  theme_settings JSONB DEFAULT '{"primary_color": "#ffcc00", "secondary_color": "#000000", "font_family": "Poppins", "layout": "grid"}'::jsonb,
  social_links JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_product_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_store_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for custom_pages
DROP POLICY IF EXISTS "Users can view their own pages" ON custom_pages;
CREATE POLICY "Users can view their own pages" ON custom_pages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = owner_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can view active pages" ON custom_pages;
CREATE POLICY "Public can view active pages" ON custom_pages
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users can manage their own pages" ON custom_pages;
CREATE POLICY "Users can manage their own pages" ON custom_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = owner_id AND profiles.user_id = auth.uid())
  );

-- Create RLS Policies for seller_product_order
DROP POLICY IF EXISTS "Sellers can manage their product order" ON seller_product_order;
CREATE POLICY "Sellers can manage their product order" ON seller_product_order
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = seller_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can view product order" ON seller_product_order;
CREATE POLICY "Public can view product order" ON seller_product_order
  FOR SELECT USING (true);

-- Create RLS Policies for affiliate_products
DROP POLICY IF EXISTS "Affiliates can manage their products" ON affiliate_products;
CREATE POLICY "Affiliates can manage their products" ON affiliate_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can view affiliate products" ON affiliate_products;
CREATE POLICY "Public can view affiliate products" ON affiliate_products
  FOR SELECT USING (true);

-- Create RLS Policies for affiliate_store_settings
DROP POLICY IF EXISTS "Affiliates can manage their store settings" ON affiliate_store_settings;
CREATE POLICY "Affiliates can manage their store settings" ON affiliate_store_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Public can view affiliate store settings" ON affiliate_store_settings;
CREATE POLICY "Public can view affiliate store settings" ON affiliate_store_settings
  FOR SELECT USING (true);

-- Create indexes (commenting out potentially problematic ones)
CREATE INDEX IF NOT EXISTS idx_custom_pages_owner ON custom_pages(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_custom_pages_slug ON custom_pages(page_slug);
-- CREATE INDEX IF NOT EXISTS idx_seller_product_order ON seller_product_order(seller_id, display_order);
-- CREATE INDEX IF NOT EXISTS idx_affiliate_products ON affiliate_products(affiliate_id, display_order);

-- SUCCESS! Tables created. Your custom page builder is now ready to use!
