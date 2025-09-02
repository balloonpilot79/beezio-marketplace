-- Advanced Search & Discovery System
-- Run this in your Supabase SQL Editor

-- 1. Create search analytics table
CREATE TABLE IF NOT EXISTS public.search_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    search_query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    clicked_product_id UUID REFERENCES public.products(id),
    search_filters JSONB DEFAULT '{}',
    search_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    session_id TEXT,
    user_agent TEXT,
    ip_address INET
);

-- 2. Create product search index for full-text search
CREATE INDEX IF NOT EXISTS idx_products_search 
ON public.products 
USING gin(to_tsvector('english', title || ' ' || description || ' ' || coalesce(array_to_string(tags, ' '), '')));

-- 3. Create category table for organized browsing
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    parent_id UUID REFERENCES public.categories(id),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create product tags table for better organization
CREATE TABLE IF NOT EXISTS public.product_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#6B7280',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create junction table for product-tag relationships
CREATE TABLE IF NOT EXISTS public.product_tag_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.product_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_id, tag_id)
);

-- 6. Create trending products view
CREATE OR REPLACE VIEW public.trending_products AS
SELECT 
    p.*,
    COALESCE(o.order_count, 0) as order_count,
    COALESCE(o.revenue, 0) as revenue,
    COALESCE(s.search_count, 0) as search_count,
    (
        COALESCE(o.order_count, 0) * 3 + 
        COALESCE(s.search_count, 0) * 1 +
        COALESCE(p.view_count, 0) * 0.5
    ) as trend_score
FROM public.products p
LEFT JOIN (
    SELECT 
        oi.product_id,
        COUNT(*) as order_count,
        SUM(oi.price * oi.quantity) as revenue
    FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE o.created_at >= NOW() - INTERVAL '7 days'
    AND o.status = 'completed'
    GROUP BY oi.product_id
) o ON p.id = o.product_id
LEFT JOIN (
    SELECT 
        clicked_product_id as product_id,
        COUNT(*) as search_count
    FROM public.search_analytics
    WHERE search_timestamp >= NOW() - INTERVAL '7 days'
    AND clicked_product_id IS NOT NULL
    GROUP BY clicked_product_id
) s ON p.id = s.product_id
WHERE p.is_active = true
ORDER BY trend_score DESC;

-- 7. Create advanced search function
CREATE OR REPLACE FUNCTION public.search_products(
    search_query TEXT DEFAULT '',
    category_filter UUID DEFAULT NULL,
    price_min DECIMAL DEFAULT NULL,
    price_max DECIMAL DEFAULT NULL,
    rating_min DECIMAL DEFAULT NULL,
    has_commission BOOLEAN DEFAULT NULL,
    is_subscription BOOLEAN DEFAULT NULL,
    seller_location TEXT DEFAULT NULL,
    sort_by TEXT DEFAULT 'relevance',
    limit_count INTEGER DEFAULT 20,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    price DECIMAL,
    images TEXT[],
    commission_rate DECIMAL,
    commission_type TEXT,
    flat_commission_amount DECIMAL,
    average_rating DECIMAL,
    review_count INTEGER,
    seller_name TEXT,
    seller_location TEXT,
    category_name TEXT,
    tag_names TEXT[],
    relevance_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description,
        p.price,
        p.images,
        p.commission_rate,
        p.commission_type,
        p.flat_commission_amount,
        p.average_rating,
        p.review_count,
        prof.full_name as seller_name,
        prof.location as seller_location,
        c.name as category_name,
        ARRAY_AGG(DISTINCT pt.name) as tag_names,
        CASE 
            WHEN search_query = '' THEN 1.0
            ELSE ts_rank(to_tsvector('english', p.title || ' ' || p.description || ' ' || coalesce(array_to_string(p.tags, ' '), '')), 
                        plainto_tsquery('english', search_query))
        END as relevance_score
    FROM public.products p
    LEFT JOIN public.profiles prof ON p.seller_id = prof.id
    LEFT JOIN public.categories c ON p.category_id = c.id
    LEFT JOIN public.product_tag_relationships ptr ON p.id = ptr.product_id
    LEFT JOIN public.product_tags pt ON ptr.tag_id = pt.id
    WHERE 
        p.is_active = true
        AND (search_query = '' OR to_tsvector('english', p.title || ' ' || p.description || ' ' || coalesce(array_to_string(p.tags, ' '), '')) @@ plainto_tsquery('english', search_query))
        AND (category_filter IS NULL OR p.category_id = category_filter)
        AND (price_min IS NULL OR p.price >= price_min)
        AND (price_max IS NULL OR p.price <= price_max)
        AND (rating_min IS NULL OR p.average_rating >= rating_min)
        AND (has_commission IS NULL OR (has_commission = true AND p.commission_rate > 0) OR (has_commission = false AND p.commission_rate = 0))
        AND (is_subscription IS NULL OR p.is_subscription = is_subscription)
        AND (seller_location IS NULL OR prof.location ILIKE '%' || seller_location || '%')
    GROUP BY p.id, p.title, p.description, p.price, p.images, p.commission_rate, p.commission_type, 
             p.flat_commission_amount, p.average_rating, p.review_count, prof.full_name, prof.location, c.name
    ORDER BY 
        CASE 
            WHEN sort_by = 'relevance' THEN relevance_score
            WHEN sort_by = 'price_asc' THEN -p.price
            WHEN sort_by = 'price_desc' THEN p.price
            WHEN sort_by = 'rating' THEN -p.average_rating
            WHEN sort_by = 'newest' THEN EXTRACT(epoch FROM p.created_at)
            ELSE relevance_score
        END DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- 8. Create search suggestions function
CREATE OR REPLACE FUNCTION public.get_search_suggestions(
    partial_query TEXT,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    suggestion TEXT,
    type TEXT,
    count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    (
        -- Product title suggestions
        SELECT DISTINCT
            p.title as suggestion,
            'product' as type,
            1 as count
        FROM public.products p
        WHERE p.title ILIKE '%' || partial_query || '%'
        AND p.is_active = true
        LIMIT limit_count / 3
    )
    UNION ALL
    (
        -- Category suggestions
        SELECT DISTINCT
            c.name as suggestion,
            'category' as type,
            (SELECT COUNT(*) FROM public.products WHERE category_id = c.id AND is_active = true)::INTEGER as count
        FROM public.categories c
        WHERE c.name ILIKE '%' || partial_query || '%'
        AND c.is_active = true
        LIMIT limit_count / 3
    )
    UNION ALL
    (
        -- Tag suggestions
        SELECT DISTINCT
            pt.name as suggestion,
            'tag' as type,
            pt.usage_count as count
        FROM public.product_tags pt
        WHERE pt.name ILIKE '%' || partial_query || '%'
        LIMIT limit_count / 3
    )
    ORDER BY count DESC, suggestion ASC;
END;
$$ LANGUAGE plpgsql;

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON public.search_analytics(search_query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_timestamp ON public.search_analytics(search_timestamp);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON public.search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_product_tags_slug ON public.product_tags(slug);
CREATE INDEX IF NOT EXISTS idx_product_tag_relationships_product ON public.product_tag_relationships(product_id);
CREATE INDEX IF NOT EXISTS idx_product_tag_relationships_tag ON public.product_tag_relationships(tag_id);

-- 10. Set up RLS policies
ALTER TABLE public.search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tag_relationships ENABLE ROW LEVEL SECURITY;

-- Search analytics policies
CREATE POLICY "Users can insert their own search analytics" ON public.search_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all search analytics" ON public.search_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'platform_admin')
        )
    );

-- Category policies
CREATE POLICY "Everyone can view active categories" ON public.categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON public.categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'platform_admin')
        )
    );

-- Product tags policies
CREATE POLICY "Everyone can view product tags" ON public.product_tags
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tags" ON public.product_tags
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Product tag relationships policies
CREATE POLICY "Everyone can view product tag relationships" ON public.product_tag_relationships
    FOR SELECT USING (true);

CREATE POLICY "Product owners can manage their product tags" ON public.product_tag_relationships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE id = product_id 
            AND seller_id = auth.uid()
        )
    );

-- 11. Insert sample categories
INSERT INTO public.categories (name, slug, description) VALUES
    ('Electronics', 'electronics', 'Gadgets, devices, and electronic products'),
    ('Fashion', 'fashion', 'Clothing, accessories, and style items'),
    ('Home & Garden', 'home-garden', 'Home decor, furniture, and garden supplies'),
    ('Health & Beauty', 'health-beauty', 'Wellness, skincare, and beauty products'),
    ('Sports & Outdoors', 'sports-outdoors', 'Athletic gear and outdoor equipment'),
    ('Books & Media', 'books-media', 'Books, movies, music, and digital content'),
    ('Toys & Games', 'toys-games', 'Children''s toys and entertainment'),
    ('Automotive', 'automotive', 'Car parts, accessories, and automotive supplies'),
    ('Food & Beverages', 'food-beverages', 'Gourmet foods and specialty drinks'),
    ('Art & Crafts', 'art-crafts', 'Creative supplies and handmade items')
ON CONFLICT (slug) DO NOTHING;

-- 12. Create function to update tag usage counts
CREATE OR REPLACE FUNCTION public.update_tag_usage_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update usage count for the affected tag
    IF TG_OP = 'INSERT' THEN
        UPDATE public.product_tags 
        SET usage_count = (
            SELECT COUNT(*) 
            FROM public.product_tag_relationships 
            WHERE tag_id = NEW.tag_id
        )
        WHERE id = NEW.tag_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.product_tags 
        SET usage_count = (
            SELECT COUNT(*) 
            FROM public.product_tag_relationships 
            WHERE tag_id = OLD.tag_id
        )
        WHERE id = OLD.tag_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 13. Create trigger for tag usage counts
CREATE TRIGGER update_tag_usage_counts_trigger
    AFTER INSERT OR DELETE ON public.product_tag_relationships
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tag_usage_counts();

-- Success message
SELECT 'Advanced Search & Discovery System setup completed successfully!' as status;
