-- Ensure unlisted products never appear to the public (100% enforcement)
-- Strategy:
-- 1) Enforce SELECT/UPDATE rules via RLS on public.products
-- 2) Ensure RPC public.search_products always filters p.is_active = true

-- Safety: ensure column exists
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Ensure RLS is enabled
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Public can only see listed products; owners/admins can also see unlisted.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'products_select_listed_or_owner_or_admin'
  ) THEN
    CREATE POLICY products_select_listed_or_owner_or_admin
      ON public.products
      FOR SELECT
      USING (
        is_active = true
        OR seller_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.user_id = auth.uid()
            AND pr.id = seller_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.user_id = auth.uid()
            AND lower(coalesce(pr.primary_role::text, pr.role::text, '')) IN ('admin', 'platform_admin')
        )
      );
  END IF;

  -- Owners/admins can update products (including toggling is_active).
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'products_update_owner_or_admin'
  ) THEN
    CREATE POLICY products_update_owner_or_admin
      ON public.products
      FOR UPDATE
      USING (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.user_id = auth.uid()
            AND pr.id = seller_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.user_id = auth.uid()
            AND lower(coalesce(pr.primary_role::text, pr.role::text, '')) IN ('admin', 'platform_admin')
        )
      )
      WITH CHECK (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.user_id = auth.uid()
            AND pr.id = seller_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles pr
          WHERE pr.user_id = auth.uid()
            AND lower(coalesce(pr.primary_role::text, pr.role::text, '')) IN ('admin', 'platform_admin')
        )
      );
  END IF;
END $$;

-- Ensure advanced search RPC never returns unlisted products.
CREATE OR REPLACE FUNCTION public.search_products(
    search_query TEXT DEFAULT '',
    category_filter UUID DEFAULT NULL,
    price_min DECIMAL DEFAULT NULL,
    price_max DECIMAL DEFAULT NULL,
    rating_min DECIMAL DEFAULT NULL,
    has_commission BOOLEAN DEFAULT NULL,
    is_subscription BOOLEAN DEFAULT NULL,
  seller_location_filter TEXT DEFAULT NULL,
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
            ELSE ts_rank(
              to_tsvector('english', p.title || ' ' || p.description || ' ' || coalesce(array_to_string(p.tags, ' '), '')),
              plainto_tsquery('english', search_query)
            )
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
        AND (seller_location_filter IS NULL OR prof.location ILIKE '%' || seller_location_filter || '%')
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

GRANT EXECUTE ON FUNCTION public.search_products(
  TEXT, UUID, DECIMAL, DECIMAL, DECIMAL, BOOLEAN, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER
) TO anon, authenticated;
