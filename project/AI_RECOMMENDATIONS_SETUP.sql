-- AI-Powered Recommendations System
-- Run this in your Supabase SQL Editor

-- 1. Create user behavior tracking table
CREATE TABLE IF NOT EXISTS public.user_behaviors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    behavior_type TEXT NOT NULL, -- 'view', 'click', 'cart_add', 'purchase', 'favorite', 'share'
    product_id UUID REFERENCES public.products(id),
    category_id UUID REFERENCES public.categories(id),
    search_query TEXT,
    duration_seconds INTEGER,
    page_url TEXT,
    referrer_url TEXT,
    device_type TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB DEFAULT '{}'
);

-- 2. Create product similarity scores table
CREATE TABLE IF NOT EXISTS public.product_similarities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_a_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_b_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,4) NOT NULL DEFAULT 0,
    similarity_type TEXT NOT NULL DEFAULT 'behavioral', -- 'behavioral', 'content', 'collaborative'
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(product_a_id, product_b_id, similarity_type)
);

-- 3. Create user preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id),
    tag_name TEXT,
    price_range_min DECIMAL,
    price_range_max DECIMAL,
    preference_score DECIMAL(5,4) NOT NULL DEFAULT 0,
    preference_type TEXT NOT NULL DEFAULT 'implicit', -- 'explicit', 'implicit'
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, category_id, tag_name)
);

-- 4. Create recommendation cache table
CREATE TABLE IF NOT EXISTS public.recommendation_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    session_id TEXT,
    recommendation_type TEXT NOT NULL, -- 'homepage', 'product_detail', 'cart', 'search'
    context_product_id UUID REFERENCES public.products(id),
    recommended_products JSONB NOT NULL DEFAULT '[]',
    recommendation_scores JSONB NOT NULL DEFAULT '{}',
    algorithm_version TEXT DEFAULT 'v1.0',
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + INTERVAL '1 hour'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_behaviors_user_id ON public.user_behaviors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_product_id ON public.user_behaviors(product_id);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_timestamp ON public.user_behaviors(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_behavior_type ON public.user_behaviors(behavior_type);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_session ON public.user_behaviors(session_id);

CREATE INDEX IF NOT EXISTS idx_product_similarities_product_a ON public.product_similarities(product_a_id);
CREATE INDEX IF NOT EXISTS idx_product_similarities_product_b ON public.product_similarities(product_b_id);
CREATE INDEX IF NOT EXISTS idx_product_similarities_score ON public.product_similarities(similarity_score DESC);
CREATE INDEX IF NOT EXISTS idx_product_similarities_type ON public.product_similarities(similarity_type);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_category ON public.user_preferences(category_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_score ON public.user_preferences(preference_score DESC);

CREATE INDEX IF NOT EXISTS idx_recommendation_cache_user ON public.recommendation_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_session ON public.recommendation_cache(session_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_type ON public.recommendation_cache(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_expires ON public.recommendation_cache(expires_at);

-- 6. Set up RLS policies
ALTER TABLE public.user_behaviors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_similarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_cache ENABLE ROW LEVEL SECURITY;

-- User behaviors policies
CREATE POLICY "Users can insert their own behaviors" ON public.user_behaviors
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own behaviors" ON public.user_behaviors
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all behaviors" ON public.user_behaviors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'platform_admin')
        )
    );

-- Product similarities policies (public read)
CREATE POLICY "Everyone can view product similarities" ON public.product_similarities
    FOR SELECT USING (true);

CREATE POLICY "System can manage similarities" ON public.product_similarities
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'platform_admin')
        )
    );

-- User preferences policies
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Recommendation cache policies
CREATE POLICY "Users can view their own recommendations" ON public.recommendation_cache
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "System can manage recommendation cache" ON public.recommendation_cache
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'platform_admin')
        )
        OR auth.uid() = user_id
        OR user_id IS NULL
    );

-- 7. Create function to get personalized recommendations
CREATE OR REPLACE FUNCTION public.get_personalized_recommendations(
    target_user_id UUID DEFAULT NULL,
    target_session_id TEXT DEFAULT NULL,
    recommendation_type TEXT DEFAULT 'homepage',
    context_product_id UUID DEFAULT NULL,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    product_id UUID,
    recommendation_score DECIMAL,
    recommendation_reason TEXT
) AS $$
DECLARE
    user_categories JSONB;
    user_tags JSONB;
    similar_users UUID[];
BEGIN
    -- Try to get cached recommendations first
    IF target_user_id IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            (jsonb_array_elements_text(recommended_products))::UUID as product_id,
            (recommendation_scores->jsonb_array_elements_text(recommended_products))::DECIMAL as recommendation_score,
            'cached' as recommendation_reason
        FROM public.recommendation_cache
        WHERE user_id = target_user_id 
        AND recommendation_type = get_personalized_recommendations.recommendation_type
        AND (context_product_id IS NULL OR context_product_id = get_personalized_recommendations.context_product_id)
        AND expires_at > NOW()
        ORDER BY recommendation_score DESC
        LIMIT limit_count;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- Generate new recommendations based on user behavior
    IF recommendation_type = 'product_detail' AND context_product_id IS NOT NULL THEN
        -- "Customers who viewed this also viewed" recommendations
        RETURN QUERY
        SELECT DISTINCT
            ub2.product_id,
            COUNT(*)::DECIMAL / 100 as recommendation_score,
            'also_viewed' as recommendation_reason
        FROM public.user_behaviors ub1
        JOIN public.user_behaviors ub2 ON ub1.user_id = ub2.user_id OR ub1.session_id = ub2.session_id
        WHERE ub1.product_id = context_product_id
        AND ub2.product_id != context_product_id
        AND ub1.behavior_type IN ('view', 'click')
        AND ub2.behavior_type IN ('view', 'click')
        AND ub1.timestamp >= NOW() - INTERVAL '30 days'
        AND ub2.timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY ub2.product_id
        ORDER BY recommendation_score DESC, ub2.product_id
        LIMIT limit_count;
        
    ELSIF recommendation_type = 'homepage' THEN
        -- Personalized homepage recommendations
        IF target_user_id IS NOT NULL THEN
            -- Get user's preferred categories
            SELECT COALESCE(json_agg(DISTINCT category_id), '[]'::json)::jsonb INTO user_categories
            FROM public.user_behaviors
            WHERE user_id = target_user_id
            AND category_id IS NOT NULL
            AND timestamp >= NOW() - INTERVAL '30 days';

            -- Recommend popular products from user's preferred categories
            RETURN QUERY
            SELECT 
                p.id as product_id,
                (COALESCE(p.average_rating, 0) * 20 + COALESCE(p.view_count, 0) * 0.1)::DECIMAL as recommendation_score,
                'category_preference' as recommendation_reason
            FROM public.products p
            WHERE p.is_active = true
            AND (user_categories = '[]'::jsonb OR p.category_id::text = ANY(SELECT jsonb_array_elements_text(user_categories)))
            ORDER BY recommendation_score DESC
            LIMIT limit_count;
        ELSE
            -- Anonymous user - show trending products
            RETURN QUERY
            SELECT 
                p.id as product_id,
                (COALESCE(p.average_rating, 0) * 10 + COALESCE(p.view_count, 0) * 0.2)::DECIMAL as recommendation_score,
                'trending' as recommendation_reason
            FROM public.products p
            WHERE p.is_active = true
            AND p.created_at >= NOW() - INTERVAL '7 days'
            ORDER BY recommendation_score DESC
            LIMIT limit_count;
        END IF;
        
    ELSIF recommendation_type = 'cart' THEN
        -- Cart recommendations - complementary products
        RETURN QUERY
        SELECT 
            p.id as product_id,
            similarity_score as recommendation_score,
            'complementary' as recommendation_reason
        FROM public.product_similarities ps
        JOIN public.products p ON ps.product_b_id = p.id
        WHERE ps.product_a_id = context_product_id
        AND p.is_active = true
        AND ps.similarity_type = 'behavioral'
        ORDER BY similarity_score DESC
        LIMIT limit_count;
        
    ELSE
        -- Default fallback - popular products
        RETURN QUERY
        SELECT 
            p.id as product_id,
            (COALESCE(p.average_rating, 0) * 10 + COALESCE(p.view_count, 0) * 0.1)::DECIMAL as recommendation_score,
            'popular' as recommendation_reason
        FROM public.products p
        WHERE p.is_active = true
        ORDER BY recommendation_score DESC
        LIMIT limit_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to calculate product similarities
CREATE OR REPLACE FUNCTION public.calculate_product_similarities()
RETURNS INTEGER AS $$
DECLARE
    similarity_count INTEGER := 0;
    product_record RECORD;
    similar_record RECORD;
    behavioral_score DECIMAL;
BEGIN
    -- Clear old similarities
    DELETE FROM public.product_similarities WHERE last_calculated < NOW() - INTERVAL '7 days';
    
    -- Calculate behavioral similarities based on user interactions
    FOR product_record IN 
        SELECT DISTINCT product_id FROM public.user_behaviors 
        WHERE product_id IS NOT NULL 
        AND timestamp >= NOW() - INTERVAL '30 days'
    LOOP
        FOR similar_record IN
            SELECT 
                ub2.product_id,
                COUNT(DISTINCT COALESCE(ub1.user_id, ub1.session_id)) as common_users
            FROM public.user_behaviors ub1
            JOIN public.user_behaviors ub2 ON (
                ub1.user_id = ub2.user_id OR 
                (ub1.user_id IS NULL AND ub2.user_id IS NULL AND ub1.session_id = ub2.session_id)
            )
            WHERE ub1.product_id = product_record.product_id
            AND ub2.product_id != product_record.product_id
            AND ub1.behavior_type IN ('view', 'click', 'cart_add', 'purchase')
            AND ub2.behavior_type IN ('view', 'click', 'cart_add', 'purchase')
            AND ub1.timestamp >= NOW() - INTERVAL '30 days'
            AND ub2.timestamp >= NOW() - INTERVAL '30 days'
            GROUP BY ub2.product_id
            HAVING COUNT(DISTINCT COALESCE(ub1.user_id, ub1.session_id)) >= 2
            ORDER BY common_users DESC
            LIMIT 20
        LOOP
            -- Calculate similarity score (0-1 based on common user interactions)
            behavioral_score := LEAST(similar_record.common_users::DECIMAL / 10, 1.0);
            
            -- Insert or update similarity
            INSERT INTO public.product_similarities (
                product_a_id, 
                product_b_id, 
                similarity_score, 
                similarity_type,
                last_calculated
            )
            VALUES (
                product_record.product_id,
                similar_record.product_id,
                behavioral_score,
                'behavioral',
                NOW()
            )
            ON CONFLICT (product_a_id, product_b_id, similarity_type)
            DO UPDATE SET 
                similarity_score = behavioral_score,
                last_calculated = NOW();
            
            similarity_count := similarity_count + 1;
        END LOOP;
    END LOOP;
    
    RETURN similarity_count;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to update user preferences
CREATE OR REPLACE FUNCTION public.update_user_preferences()
RETURNS TRIGGER AS $$
DECLARE
    category_score DECIMAL;
    existing_score DECIMAL;
BEGIN
    -- Only process meaningful behaviors
    IF NEW.behavior_type NOT IN ('view', 'click', 'cart_add', 'purchase', 'favorite') THEN
        RETURN NEW;
    END IF;
    
    -- Only for logged-in users
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Calculate score based on behavior type
    category_score := CASE NEW.behavior_type
        WHEN 'view' THEN 0.1
        WHEN 'click' THEN 0.2
        WHEN 'cart_add' THEN 0.5
        WHEN 'purchase' THEN 1.0
        WHEN 'favorite' THEN 0.8
        ELSE 0.1
    END;
    
    -- Update category preference if we have category info
    IF NEW.category_id IS NOT NULL THEN
        -- Get existing score
        SELECT preference_score INTO existing_score
        FROM public.user_preferences
        WHERE user_id = NEW.user_id
        AND category_id = NEW.category_id
        AND tag_name IS NULL;
        
        -- Insert or update preference
        INSERT INTO public.user_preferences (
            user_id,
            category_id,
            preference_score,
            preference_type,
            last_updated
        )
        VALUES (
            NEW.user_id,
            NEW.category_id,
            category_score,
            'implicit',
            NOW()
        )
        ON CONFLICT (user_id, category_id, tag_name)
        DO UPDATE SET
            preference_score = LEAST(user_preferences.preference_score + category_score, 10.0),
            last_updated = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger for user preference updates
CREATE TRIGGER update_user_preferences_trigger
    AFTER INSERT ON public.user_behaviors
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_preferences();

-- 11. Create function to clean up old data
CREATE OR REPLACE FUNCTION public.cleanup_recommendation_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean up expired recommendation cache
    DELETE FROM public.recommendation_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old user behaviors (keep 90 days)
    DELETE FROM public.user_behaviors WHERE timestamp < NOW() - INTERVAL '90 days';
    
    -- Clean up old similarities (recalculated regularly)
    DELETE FROM public.product_similarities WHERE last_calculated < NOW() - INTERVAL '14 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 12. Create view for recommendation analytics
CREATE OR REPLACE VIEW public.recommendation_analytics AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    behavior_type,
    COUNT(*) as behavior_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT product_id) as unique_products
FROM public.user_behaviors
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', timestamp), behavior_type
ORDER BY date DESC, behavior_count DESC;

-- Success message
SELECT 'AI-Powered Recommendations System setup completed successfully!' as status;
