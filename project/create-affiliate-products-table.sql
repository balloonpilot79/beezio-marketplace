-- ========================================
-- AFFILIATE PRODUCT PROMOTION SYSTEM
-- Allows affiliates to add sellers' products to their store
-- ========================================

-- Create affiliate_products table - tracks which products affiliates are promoting
CREATE TABLE IF NOT EXISTS public.affiliate_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Affiliate display settings (NO commission/price changes - seller controls that!)
    is_featured BOOLEAN DEFAULT false, -- Pin to top of affiliate store
    is_active BOOLEAN DEFAULT true, -- Affiliate can pause promotion of this product
    
    -- Affiliate's custom content (for their own marketing)
    affiliate_description TEXT, -- Affiliate can write their own description
    affiliate_tags TEXT[], -- Additional tags for their store
    custom_images TEXT[], -- Affiliate can add their own promotional images
    
    -- Performance tracking
    clicks INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0,
    
    -- Metadata
    added_at TIMESTAMPTZ DEFAULT NOW(),
    last_promoted_at TIMESTAMPTZ,
    promoted_count INTEGER DEFAULT 0,
    notes TEXT, -- Private notes for affiliate
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure affiliate can't add same product twice
    UNIQUE(affiliate_id, product_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_products_affiliate_id ON public.affiliate_products(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_product_id ON public.affiliate_products(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_seller_id ON public.affiliate_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_is_active ON public.affiliate_products(is_active);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_is_featured ON public.affiliate_products(is_featured);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_added_at ON public.affiliate_products(added_at DESC);

-- Enable RLS
ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Affiliates can view their own promoted products"
    ON public.affiliate_products
    FOR SELECT
    USING (auth.uid() = affiliate_id);

CREATE POLICY "Sellers can view who promotes their products"
    ON public.affiliate_products
    FOR SELECT
    USING (auth.uid() = seller_id);

CREATE POLICY "Affiliates can add products to promote"
    ON public.affiliate_products
    FOR INSERT
    WITH CHECK (auth.uid() = affiliate_id);

CREATE POLICY "Affiliates can update their promoted products"
    ON public.affiliate_products
    FOR UPDATE
    USING (auth.uid() = affiliate_id);

CREATE POLICY "Affiliates can remove products from their store"
    ON public.affiliate_products
    FOR DELETE
    USING (auth.uid() = affiliate_id);

-- Anyone can view affiliate products that are active
CREATE POLICY "Public can view active affiliate products"
    ON public.affiliate_products
    FOR SELECT
    USING (
        -- Check if the affiliate_products row is active (ap.is_active)
        is_active = true
    );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_affiliate_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_affiliate_products_updated_at ON public.affiliate_products;
CREATE TRIGGER update_affiliate_products_updated_at
    BEFORE UPDATE ON public.affiliate_products
    FOR EACH ROW
    EXECUTE FUNCTION update_affiliate_products_updated_at();

-- Function to increment click/view counters
CREATE OR REPLACE FUNCTION increment_affiliate_product_metric(
    p_affiliate_id UUID,
    p_product_id UUID,
    p_metric TEXT -- 'clicks', 'views', 'conversions'
)
RETURNS VOID AS $$
BEGIN
    IF p_metric = 'clicks' THEN
        UPDATE public.affiliate_products 
        SET clicks = clicks + 1, last_promoted_at = NOW(), promoted_count = promoted_count + 1
        WHERE affiliate_id = p_affiliate_id AND product_id = p_product_id;
    ELSIF p_metric = 'views' THEN
        UPDATE public.affiliate_products 
        SET views = views + 1
        WHERE affiliate_id = p_affiliate_id AND product_id = p_product_id;
    ELSIF p_metric = 'conversions' THEN
        UPDATE public.affiliate_products 
        SET conversions = conversions + 1
        WHERE affiliate_id = p_affiliate_id AND product_id = p_product_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add promoted_by_affiliates count to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS promoted_by_affiliates INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_promotable BOOLEAN DEFAULT true;

-- Function to update product's affiliate count
CREATE OR REPLACE FUNCTION update_product_affiliate_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.products 
        SET promoted_by_affiliates = promoted_by_affiliates + 1
        WHERE id = NEW.product_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.products 
        SET promoted_by_affiliates = GREATEST(0, promoted_by_affiliates - 1)
        WHERE id = OLD.product_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_affiliate_count ON public.affiliate_products;
CREATE TRIGGER update_product_affiliate_count
    AFTER INSERT OR DELETE ON public.affiliate_products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_affiliate_count();

-- View for easy querying of affiliate stores with full product details
-- Drop if exists as table or view
DROP TABLE IF EXISTS affiliate_store_products CASCADE;
DROP VIEW IF EXISTS affiliate_store_products CASCADE;

CREATE VIEW affiliate_store_products AS
SELECT 
    ap.*,
    p.title,
    p.description,
    p.price,
    p.images,
    p.category_id,
    p.stock_quantity,
    p.commission_rate,
    p.commission_type,
    seller.full_name as seller_name,
    seller.email as seller_email,
    affiliate.full_name as affiliate_name,
    affiliate.email as affiliate_email
FROM public.affiliate_products ap
JOIN public.products p ON ap.product_id = p.id
LEFT JOIN public.profiles seller ON ap.seller_id = seller.id
LEFT JOIN public.profiles affiliate ON ap.affiliate_id = affiliate.id;

-- Grant permissions
GRANT ALL ON public.affiliate_products TO authenticated;
GRANT SELECT ON affiliate_store_products TO authenticated;

-- Create affiliate_links table for tracking individual affiliate links
CREATE TABLE IF NOT EXISTS public.affiliate_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    link_code TEXT NOT NULL UNIQUE, -- Short code like "XYZ123"
    full_url TEXT NOT NULL,
    
    -- Tracking
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_commission DECIMAL(10,2) DEFAULT 0,
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    
    -- Custom tracking parameters
    campaign_name TEXT,
    source TEXT, -- 'facebook', 'instagram', 'email', etc.
    medium TEXT, -- 'social', 'email', 'banner', etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_clicked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate_id ON public.affiliate_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_product_id ON public.affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_link_code ON public.affiliate_links(link_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_is_active ON public.affiliate_links(is_active);

ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates can manage their own links"
    ON public.affiliate_links
    FOR ALL
    USING (auth.uid() = affiliate_id)
    WITH CHECK (auth.uid() = affiliate_id);

CREATE POLICY "Public can view active affiliate links"
    ON public.affiliate_links
    FOR SELECT
    USING (is_active = true);

GRANT ALL ON public.affiliate_links TO authenticated;

-- Function to generate unique link code
CREATE OR REPLACE FUNCTION generate_affiliate_link_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code exists, regenerate if it does
    IF EXISTS (SELECT 1 FROM public.affiliate_links WHERE link_code = result) THEN
        RETURN generate_affiliate_link_code();
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.affiliate_products IS 'Products that affiliates have added to their personal store for promotion';
COMMENT ON TABLE public.affiliate_links IS 'Individual affiliate tracking links with performance metrics';
COMMENT ON FUNCTION generate_affiliate_link_code() IS 'Generates unique 8-character codes for affiliate links';
