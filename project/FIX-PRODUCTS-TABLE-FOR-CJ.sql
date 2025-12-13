-- =====================================================
-- FIX PRODUCTS TABLE FOR CJ DROPSHIPPING INTEGRATION
-- =====================================================
-- This adds the columns that CJProductImportPage.tsx expects
-- Run this in Supabase SQL Editor BEFORE using CJ import

-- Add CJ-specific columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS is_promotable BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dropship_provider TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS is_digital BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS affiliate_commission_rate INTEGER DEFAULT 10;

-- Remove UNIQUE constraint from sku if it exists (CJ products might share SKUs)
DO $$
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_dropship_provider 
ON products(dropship_provider) 
WHERE dropship_provider IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_promotable 
ON products(is_promotable) 
WHERE is_promotable = true;

CREATE INDEX IF NOT EXISTS idx_products_sku 
ON products(sku) 
WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_slug 
ON products(slug) 
WHERE slug IS NOT NULL;

-- Update existing products to be promotable in marketplace
UPDATE products 
SET is_promotable = true 
WHERE is_promotable IS NULL AND is_active = true;

-- Create CJ product mappings table if it doesn't exist
CREATE TABLE IF NOT EXISTS cj_product_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  beezio_product_id UUID REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  cj_product_id TEXT NOT NULL,
  cj_product_sku TEXT NOT NULL,
  cj_cost NUMERIC(10,2) NOT NULL,
  markup_percent INTEGER NOT NULL,
  affiliate_commission_percent INTEGER NOT NULL,
  price_breakdown JSONB NOT NULL,
  last_synced TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cj_mappings_cj_product_id 
ON cj_product_mappings(cj_product_id);

CREATE INDEX IF NOT EXISTS idx_cj_mappings_cj_sku 
ON cj_product_mappings(cj_product_sku);

-- Create storefront_products table (links affiliates/fundraisers to products)
CREATE TABLE IF NOT EXISTS storefront_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  custom_price NUMERIC(10,2), -- Optional: override product price
  custom_description TEXT, -- Optional: custom pitch
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id) -- Can't add same product twice
);

CREATE INDEX IF NOT EXISTS idx_storefront_products_user 
ON storefront_products(user_id);

CREATE INDEX IF NOT EXISTS idx_storefront_products_product 
ON storefront_products(product_id);

-- Create affiliate_links table (custom tracking links)
CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  link_code TEXT NOT NULL UNIQUE, -- Short code like "JASON-EARBUDS"
  full_url TEXT NOT NULL, -- https://beezio.co/p/product-slug?ref=JASON-EARBUDS
  qr_code_url TEXT, -- QR code image URL
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  total_earnings NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_clicked_at TIMESTAMPTZ,
  UNIQUE(user_id, product_id) -- One link per product per affiliate
);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_user 
ON affiliate_links(user_id);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_link_code 
ON affiliate_links(link_code);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_product 
ON affiliate_links(product_id);

-- Enable Row Level Security (RLS) on new tables
ALTER TABLE storefront_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for storefront_products
CREATE POLICY "Users can view their own storefront products" 
ON storefront_products FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can add products to their storefront" 
ON storefront_products FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove products from their storefront" 
ON storefront_products FOR DELETE 
USING (user_id = auth.uid());

CREATE POLICY "Anyone can view storefront products" 
ON storefront_products FOR SELECT 
USING (true);

-- RLS Policies for affiliate_links
CREATE POLICY "Users can view their own affiliate links" 
ON affiliate_links FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own affiliate links" 
ON affiliate_links FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own affiliate links" 
ON affiliate_links FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Anyone can view affiliate links by code" 
ON affiliate_links FOR SELECT 
USING (true);

-- SUCCESS MESSAGE
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅ COMPLETE CJ WORKFLOW SYSTEM READY!';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📦 PRODUCTS TABLE ENHANCED:';
  RAISE NOTICE '   • sku - Product SKU from CJ';
  RAISE NOTICE '   • is_promotable - Shows in marketplace';
  RAISE NOTICE '   • dropship_provider - Tracks "cj"';
  RAISE NOTICE '   • image_url - Single product image';
  RAISE NOTICE '   • is_digital - Physical vs digital';
  RAISE NOTICE '   • slug - URL-friendly identifier';
  RAISE NOTICE '   • affiliate_commission_rate - Commission %';
  RAISE NOTICE '';
  RAISE NOTICE '🗃️ NEW TABLES CREATED:';
  RAISE NOTICE '   • cj_product_mappings - CJ API integration';
  RAISE NOTICE '   • storefront_products - Affiliate/Fundraiser stores';
  RAISE NOTICE '   • affiliate_links - Custom tracking links & QR codes';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 COMPLETE WORKFLOW ENABLED:';
  RAISE NOTICE '   1. Admin imports from CJ → Products added';
  RAISE NOTICE '   2. Products appear in Marketplace';
  RAISE NOTICE '   3. Affiliates/Fundraisers add to their stores';
  RAISE NOTICE '   4. Custom links & QR codes generated';
  RAISE NOTICE '   5. Sales tracked & commissions calculated';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 NEXT STEPS:';
  RAISE NOTICE '   1. Run TEST-CJ-PRODUCT-INSERT.sql';
  RAISE NOTICE '   2. Test product appears in marketplace';
  RAISE NOTICE '   3. Test adding to affiliate store';
  RAISE NOTICE '   4. Test custom link generation';
  RAISE NOTICE '';
END $$;

-- VERIFICATION: Check columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('sku', 'is_promotable', 'dropship_provider', 'image_url', 'is_digital', 'slug', 'affiliate_commission_rate')
ORDER BY column_name;
