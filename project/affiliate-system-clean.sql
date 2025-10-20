-- ========================================
-- AFFILIATE PRODUCT PROMOTION SYSTEM
-- Clean version - NO RLS policies (use app layer auth)
-- ========================================

-- Create affiliate_products table
CREATE TABLE IF NOT EXISTS public.affiliate_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    affiliate_description TEXT,
    affiliate_tags TEXT[],
    custom_images TEXT[],
    clicks INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    last_promoted_at TIMESTAMPTZ,
    promoted_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(affiliate_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_products_affiliate_id ON public.affiliate_products(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_product_id ON public.affiliate_products(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_seller_id ON public.affiliate_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_is_active ON public.affiliate_products(is_active);

-- Create affiliate_links table
CREATE TABLE IF NOT EXISTS public.affiliate_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    link_code TEXT NOT NULL UNIQUE,
    full_url TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_commission DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    campaign_name TEXT,
    source TEXT,
    medium TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_clicked_at TIMESTAMPTZ
);

-- Indexes for links
CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate_id ON public.affiliate_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_product_id ON public.affiliate_links(product_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_link_code ON public.affiliate_links(link_code);

-- Add columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS promoted_by_affiliates INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_promotable BOOLEAN DEFAULT true;

-- View for affiliate stores
DROP VIEW IF EXISTS affiliate_store_products CASCADE;
CREATE VIEW affiliate_store_products AS
SELECT 
    ap.id,
    ap.affiliate_id,
    ap.product_id,
    ap.seller_id,
    ap.is_featured,
    ap.is_active,
    ap.affiliate_description,
    ap.affiliate_tags,
    ap.custom_images,
    ap.clicks,
    ap.views,
    ap.conversions,
    ap.total_earnings,
    ap.created_at,
    ap.updated_at,
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
    
    IF EXISTS (SELECT 1 FROM public.affiliate_links WHERE link_code = result) THEN
        RETURN generate_affiliate_link_code();
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to increment metrics
CREATE OR REPLACE FUNCTION increment_affiliate_product_metric(
    p_affiliate_id UUID,
    p_product_id UUID,
    p_metric TEXT
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

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_affiliate_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS affiliate_products_updated_at ON public.affiliate_products;
CREATE TRIGGER affiliate_products_updated_at
    BEFORE UPDATE ON public.affiliate_products
    FOR EACH ROW
    EXECUTE FUNCTION update_affiliate_products_updated_at();

-- Trigger to update product affiliate count
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

DROP TRIGGER IF EXISTS affiliate_products_count ON public.affiliate_products;
CREATE TRIGGER affiliate_products_count
    AFTER INSERT OR DELETE ON public.affiliate_products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_affiliate_count();

-- Grant access
GRANT ALL ON public.affiliate_products TO authenticated;
GRANT ALL ON public.affiliate_links TO authenticated;
GRANT SELECT ON affiliate_store_products TO authenticated;
