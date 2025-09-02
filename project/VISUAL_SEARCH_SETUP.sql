-- Visual Search Database Setup
-- This file sets up the infrastructure for AI-powered visual search functionality

-- 1. Create table for storing product image embeddings/features
CREATE TABLE IF NOT EXISTS product_image_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_features VECTOR(512), -- Store image embeddings (adjust dimensions as needed)
    feature_type TEXT DEFAULT 'clip', -- Type of features (CLIP, ResNet, etc.)
    extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(product_id, image_url)
);

-- 2. Create indexes for efficient similarity search
CREATE INDEX IF NOT EXISTS idx_product_image_features_product_id ON product_image_features(product_id);
CREATE INDEX IF NOT EXISTS idx_product_image_features_type ON product_image_features(feature_type);

-- 3. Create table for visual search history
CREATE TABLE IF NOT EXISTS visual_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    search_image_url TEXT NOT NULL,
    search_features VECTOR(512),
    results_count INTEGER DEFAULT 0,
    search_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id TEXT,
    
    -- Store search metadata
    image_size INTEGER,
    image_format TEXT,
    processing_time_ms INTEGER
);

-- 4. Create indexes for search history
CREATE INDEX IF NOT EXISTS idx_visual_search_history_user_id ON visual_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_visual_search_history_timestamp ON visual_search_history(search_timestamp);

-- 5. Function to calculate image similarity (placeholder - would integrate with AI service)
CREATE OR REPLACE FUNCTION calculate_image_similarity(
    features1 VECTOR(512),
    features2 VECTOR(512)
) RETURNS FLOAT AS $$
BEGIN
    -- This is a simplified cosine similarity calculation
    -- In production, you'd want to use a proper vector similarity function
    -- or integrate with services like OpenAI CLIP, Google Vision API, etc.
    
    RETURN 1.0 - (features1 <-> features2); -- Using pgvector cosine distance
END;
$$ LANGUAGE plpgsql;

-- 6. Main visual search function
CREATE OR REPLACE FUNCTION visual_search_products(
    search_image_url TEXT,
    similarity_threshold FLOAT DEFAULT 0.3,
    max_results INTEGER DEFAULT 20
) RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    price DECIMAL(10,2),
    images TEXT[],
    seller_id UUID,
    seller_name TEXT,
    similarity_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Note: This is a simplified version. In production, you would:
    -- 1. Extract features from the search_image_url using an AI service
    -- 2. Compare against stored product image features
    -- 3. Return ranked results by similarity
    
    -- For now, we'll return a sample of products with random similarity scores
    -- This should be replaced with actual feature extraction and comparison
    
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description,
        p.price,
        p.images,
        p.seller_id,
        COALESCE(prof.full_name, 'Unknown Seller') as seller_name,
        (0.3 + random() * 0.7)::FLOAT as similarity_score, -- Random similarity for demo
        p.created_at
    FROM products p
    LEFT JOIN profiles prof ON p.seller_id = prof.user_id
    WHERE p.images IS NOT NULL 
      AND array_length(p.images, 1) > 0
    ORDER BY random() -- In production, order by actual similarity score
    LIMIT max_results;
    
    -- TODO: Replace the above with actual visual similarity search:
    /*
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description,
        p.price,
        p.images,
        p.seller_id,
        COALESCE(prof.full_name, 'Unknown Seller') as seller_name,
        pif.similarity_score,
        p.created_at
    FROM products p
    LEFT JOIN profiles prof ON p.seller_id = prof.user_id
    INNER JOIN (
        SELECT 
            product_id,
            calculate_image_similarity(image_features, search_features) as similarity_score
        FROM product_image_features 
        WHERE calculate_image_similarity(image_features, search_features) >= similarity_threshold
        ORDER BY similarity_score DESC
        LIMIT max_results
    ) pif ON p.id = pif.product_id
    ORDER BY pif.similarity_score DESC;
    */
END;
$$ LANGUAGE plpgsql;

-- 7. Function to extract and store image features (placeholder)
CREATE OR REPLACE FUNCTION extract_product_image_features(
    product_id_param UUID,
    image_url_param TEXT
) RETURNS UUID AS $$
DECLARE
    feature_id UUID;
    dummy_features VECTOR(512);
BEGIN
    -- This is a placeholder function. In production, you would:
    -- 1. Call an AI service (OpenAI CLIP, Google Vision, AWS Rekognition, etc.)
    -- 2. Extract actual image features/embeddings
    -- 3. Store them in the product_image_features table
    
    -- Generate dummy features for demo (replace with actual feature extraction)
    dummy_features := array_fill(random()::FLOAT, ARRAY[512])::VECTOR(512);
    
    INSERT INTO product_image_features (
        product_id,
        image_url,
        image_features,
        feature_type
    ) VALUES (
        product_id_param,
        image_url_param,
        dummy_features,
        'demo'
    ) ON CONFLICT (product_id, image_url) 
    DO UPDATE SET 
        image_features = EXCLUDED.image_features,
        extracted_at = NOW()
    RETURNING id INTO feature_id;
    
    RETURN feature_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger to automatically extract features when products are created/updated
CREATE OR REPLACE FUNCTION trigger_extract_image_features()
RETURNS TRIGGER AS $$
DECLARE
    image_url TEXT;
BEGIN
    -- Extract features for each image when a product is created or updated
    IF NEW.images IS NOT NULL THEN
        FOREACH image_url IN ARRAY NEW.images
        LOOP
            PERFORM extract_product_image_features(NEW.id, image_url);
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS extract_image_features_trigger ON products;
CREATE TRIGGER extract_image_features_trigger
    AFTER INSERT OR UPDATE OF images ON products
    FOR EACH ROW
    EXECUTE FUNCTION trigger_extract_image_features();

-- 9. Function to log visual search attempts
CREATE OR REPLACE FUNCTION log_visual_search(
    user_id_param UUID,
    search_image_url_param TEXT,
    results_count_param INTEGER,
    session_id_param TEXT DEFAULT NULL,
    image_size_param INTEGER DEFAULT NULL,
    image_format_param TEXT DEFAULT NULL,
    processing_time_ms_param INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    search_id UUID;
BEGIN
    INSERT INTO visual_search_history (
        user_id,
        search_image_url,
        results_count,
        session_id,
        image_size,
        image_format,
        processing_time_ms
    ) VALUES (
        user_id_param,
        search_image_url_param,
        results_count_param,
        session_id_param,
        image_size_param,
        image_format_param,
        processing_time_ms_param
    ) RETURNING id INTO search_id;
    
    RETURN search_id;
END;
$$ LANGUAGE plpgsql;

-- 10. Analytics view for visual search performance
CREATE OR REPLACE VIEW visual_search_analytics AS
SELECT 
    DATE_TRUNC('day', search_timestamp) as search_date,
    COUNT(*) as total_searches,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(results_count) as avg_results_per_search,
    AVG(processing_time_ms) as avg_processing_time_ms,
    
    -- Top image formats
    COUNT(CASE WHEN image_format = 'image/jpeg' THEN 1 END) as jpeg_searches,
    COUNT(CASE WHEN image_format = 'image/png' THEN 1 END) as png_searches,
    
    -- Search success rate (searches with results)
    (COUNT(CASE WHEN results_count > 0 THEN 1 END)::FLOAT / COUNT(*) * 100) as success_rate_percent
FROM visual_search_history
GROUP BY DATE_TRUNC('day', search_timestamp)
ORDER BY search_date DESC;

-- 11. Enable RLS (Row Level Security)
ALTER TABLE product_image_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_search_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_image_features
CREATE POLICY "Public can view product image features" ON product_image_features
    FOR SELECT USING (true);

CREATE POLICY "Sellers can manage their product image features" ON product_image_features
    FOR ALL USING (
        product_id IN (
            SELECT id FROM products WHERE seller_id = auth.uid()
        )
    );

-- RLS Policies for visual_search_history
CREATE POLICY "Users can view their own search history" ON visual_search_history
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own search history" ON visual_search_history
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admin access for analytics
CREATE POLICY "Admins can view all search history" ON visual_search_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 12. Sample data for testing (optional)
-- This would typically be handled by your application when products are uploaded
/*
INSERT INTO product_image_features (product_id, image_url, image_features, feature_type)
SELECT 
    p.id,
    p.images[1] as image_url,
    array_fill(random()::FLOAT, ARRAY[512])::VECTOR(512) as dummy_features,
    'demo' as feature_type
FROM products p 
WHERE p.images IS NOT NULL 
  AND array_length(p.images, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM product_image_features pif 
    WHERE pif.product_id = p.id 
    AND pif.image_url = p.images[1]
  );
*/

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON TABLE product_image_features TO authenticated;
GRANT ALL ON TABLE visual_search_history TO authenticated;
GRANT EXECUTE ON FUNCTION visual_search_products TO authenticated;
GRANT EXECUTE ON FUNCTION extract_product_image_features TO authenticated;
GRANT EXECUTE ON FUNCTION log_visual_search TO authenticated;
GRANT SELECT ON visual_search_analytics TO authenticated;

-- Notes for Production Implementation:
-- 
-- 1. Image Feature Extraction:
--    - Integrate with OpenAI CLIP API for semantic image understanding
--    - Use Google Cloud Vision API for object detection and labeling
--    - Consider AWS Rekognition for comprehensive image analysis
--    - Use specialized e-commerce image models for better product matching
--
-- 2. Vector Similarity:
--    - Install pgvector extension for efficient vector operations
--    - Use approximate nearest neighbor (ANN) indexes for scale
--    - Consider using dedicated vector databases like Pinecone or Weaviate
--
-- 3. Performance Optimization:
--    - Implement proper indexing strategies for large-scale search
--    - Use caching for frequently searched images
--    - Consider image preprocessing and normalization
--    - Implement batch processing for feature extraction
--
-- 4. User Experience:
--    - Add image preprocessing (crop, resize, enhance)
--    - Implement progressive loading for search results
--    - Add filters for similarity threshold adjustment
--    - Consider multiple search modes (exact, similar, conceptual)

COMMENT ON TABLE product_image_features IS 'Stores extracted visual features for product images used in visual search';
COMMENT ON TABLE visual_search_history IS 'Tracks visual search attempts for analytics and personalization';
COMMENT ON FUNCTION visual_search_products IS 'Main function for finding visually similar products';
COMMENT ON VIEW visual_search_analytics IS 'Analytics dashboard for visual search performance metrics';
