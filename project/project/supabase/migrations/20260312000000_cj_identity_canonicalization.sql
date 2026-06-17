ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS cj_pid text,
  ADD COLUMN IF NOT EXISTS cj_product_code text,
  ADD COLUMN IF NOT EXISTS cj_product_sku text,
  ADD COLUMN IF NOT EXISTS cj_spu text,
  ADD COLUMN IF NOT EXISTS cj_name_raw text,
  ADD COLUMN IF NOT EXISTS cj_source_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS searchable_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS legacy_code text,
  ADD COLUMN IF NOT EXISTS display_search_code text,
  ADD COLUMN IF NOT EXISTS source_import_version text NOT NULL DEFAULT 'cj-import-v2';

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS cj_vid text,
  ADD COLUMN IF NOT EXISTS cj_variant_sku text,
  ADD COLUMN IF NOT EXISTS cj_variant_code text,
  ADD COLUMN IF NOT EXISTS cj_sku text,
  ADD COLUMN IF NOT EXISTS cj_option_summary text,
  ADD COLUMN IF NOT EXISTS supplier_variant_ref text,
  ADD COLUMN IF NOT EXISTS external_inventory_key text,
  ADD COLUMN IF NOT EXISTS variant_display_sku text,
  ADD COLUMN IF NOT EXISTS searchable_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS is_orderable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_reference_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS raw_variant_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS import_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS legacy_code text;

CREATE TABLE IF NOT EXISTS public.cj_import_repair_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  action text NOT NULL,
  previous_display_sku text,
  new_display_sku text,
  previous_order_key text,
  new_order_key text,
  source_import_version text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_source ON public.products(source);
CREATE INDEX IF NOT EXISTS idx_products_cj_pid ON public.products(cj_pid);
CREATE INDEX IF NOT EXISTS idx_products_cj_product_code ON public.products(cj_product_code);
CREATE INDEX IF NOT EXISTS idx_products_cj_product_sku ON public.products(cj_product_sku);
CREATE INDEX IF NOT EXISTS idx_products_cj_spu ON public.products(cj_spu);
CREATE INDEX IF NOT EXISTS idx_products_display_search_code ON public.products(display_search_code);
CREATE INDEX IF NOT EXISTS idx_products_searchable_codes_gin ON public.products USING gin (searchable_codes);

CREATE INDEX IF NOT EXISTS idx_product_variants_source ON public.product_variants(source);
CREATE INDEX IF NOT EXISTS idx_product_variants_cj_vid ON public.product_variants(cj_vid);
CREATE INDEX IF NOT EXISTS idx_product_variants_cj_variant_sku ON public.product_variants(cj_variant_sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_cj_variant_code ON public.product_variants(cj_variant_code);
CREATE INDEX IF NOT EXISTS idx_product_variants_cj_sku ON public.product_variants(cj_sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_variant_display_sku ON public.product_variants(variant_display_sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_searchable_codes_gin ON public.product_variants USING gin (searchable_codes);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_import_status_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_import_status_check
      CHECK (import_status IN ('ready', 'needs_review'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_import_status_check'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_import_status_check
      CHECK (import_status IN ('ready', 'needs_review'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_variants_order_reference_type_check'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_order_reference_type_check
      CHECK (order_reference_type IN ('cj_vid', 'cj_variant_id', 'none'));
  END IF;
END $$;

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
    relevance_score REAL,
    matched_variant_id UUID,
    matched_variant_sku TEXT,
    matched_code TEXT,
    match_type TEXT
) AS $$
DECLARE
  normalized_query text := upper(trim(coalesce(search_query, '')));
BEGIN
  RETURN QUERY
  WITH variant_matches AS (
    SELECT
      pv.product_id,
      pv.id AS variant_id,
      pv.variant_display_sku,
      CASE
        WHEN normalized_query = '' THEN NULL
        WHEN EXISTS (
          SELECT 1
          FROM unnest(coalesce(pv.searchable_codes, '{}'::text[])) AS code
          WHERE upper(trim(code)) = normalized_query
        ) THEN 'exact_code'
        WHEN EXISTS (
          SELECT 1
          FROM unnest(coalesce(pv.searchable_codes, '{}'::text[])) AS code
          WHERE upper(trim(code)) LIKE '%' || normalized_query || '%'
        ) THEN 'partial_code'
        ELSE NULL
      END AS match_type,
      (
        SELECT code
        FROM unnest(coalesce(pv.searchable_codes, '{}'::text[])) AS code
        WHERE upper(trim(code)) = normalized_query
           OR upper(trim(code)) LIKE '%' || normalized_query || '%'
        ORDER BY CASE WHEN upper(trim(code)) = normalized_query THEN 0 ELSE 1 END, length(code)
        LIMIT 1
      ) AS matched_code
    FROM public.product_variants pv
    WHERE pv.is_active = true
  ),
  ranked AS (
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
      prof.full_name AS seller_name,
      prof.location AS seller_location,
      c.name AS category_name,
      array_remove(array_agg(DISTINCT pt.name), NULL) AS tag_names,
      vm.variant_id AS matched_variant_id,
      vm.variant_display_sku AS matched_variant_sku,
      vm.matched_code,
      COALESCE(
        vm.match_type,
        CASE
          WHEN normalized_query <> ''
            AND EXISTS (
              SELECT 1
              FROM unnest(coalesce(p.searchable_codes, '{}'::text[])) AS code
              WHERE upper(trim(code)) = normalized_query
            ) THEN 'exact_code'
          WHEN normalized_query <> ''
            AND EXISTS (
              SELECT 1
              FROM unnest(coalesce(p.searchable_codes, '{}'::text[])) AS code
              WHERE upper(trim(code)) LIKE '%' || normalized_query || '%'
            ) THEN 'partial_code'
          WHEN normalized_query <> ''
            AND (
              p.title ILIKE '%' || search_query || '%'
              OR coalesce(p.description, '') ILIKE '%' || search_query || '%'
            ) THEN 'text'
          ELSE 'browse'
        END
      ) AS match_type,
      CASE
        WHEN normalized_query = '' THEN 1.0
        WHEN vm.match_type = 'exact_code' THEN 1000.0
        WHEN EXISTS (
          SELECT 1
          FROM unnest(coalesce(p.searchable_codes, '{}'::text[])) AS code
          WHERE upper(trim(code)) = normalized_query
        ) THEN 900.0
        WHEN vm.match_type = 'partial_code' THEN 700.0
        WHEN EXISTS (
          SELECT 1
          FROM unnest(coalesce(p.searchable_codes, '{}'::text[])) AS code
          WHERE upper(trim(code)) LIKE '%' || normalized_query || '%'
        ) THEN 600.0
        WHEN (
          p.title ILIKE '%' || search_query || '%'
          OR coalesce(p.description, '') ILIKE '%' || search_query || '%'
        ) THEN 100.0
        ELSE 1.0
      END AS relevance_score
    FROM public.products p
    LEFT JOIN public.profiles prof ON p.seller_id = prof.id
    LEFT JOIN public.categories c ON p.category_id = c.id
    LEFT JOIN public.product_tag_relationships ptr ON p.id = ptr.product_id
    LEFT JOIN public.product_tags pt ON ptr.tag_id = pt.id
    LEFT JOIN LATERAL (
      SELECT *
      FROM variant_matches vm_inner
      WHERE vm_inner.product_id = p.id
        AND vm_inner.match_type IS NOT NULL
      ORDER BY CASE vm_inner.match_type WHEN 'exact_code' THEN 0 WHEN 'partial_code' THEN 1 ELSE 2 END
      LIMIT 1
    ) vm ON true
    WHERE p.is_active = true
      AND coalesce(p.import_status, 'ready') <> 'needs_review'
      AND (category_filter IS NULL OR p.category_id = category_filter)
      AND (price_min IS NULL OR p.price >= price_min)
      AND (price_max IS NULL OR p.price <= price_max)
      AND (rating_min IS NULL OR p.average_rating >= rating_min)
      AND (has_commission IS NULL OR (has_commission = true AND p.commission_rate > 0) OR (has_commission = false AND p.commission_rate = 0))
      AND (is_subscription IS NULL OR p.is_subscription = is_subscription)
      AND (seller_location_filter IS NULL OR prof.location ILIKE '%' || seller_location_filter || '%')
      AND (
        normalized_query = ''
        OR vm.match_type IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(p.searchable_codes, '{}'::text[])) AS code
          WHERE upper(trim(code)) = normalized_query
             OR upper(trim(code)) LIKE '%' || normalized_query || '%'
        )
        OR p.title ILIKE '%' || search_query || '%'
        OR coalesce(p.description, '') ILIKE '%' || search_query || '%'
      )
    GROUP BY
      p.id, p.title, p.description, p.price, p.images, p.commission_rate, p.commission_type,
      p.flat_commission_amount, p.average_rating, p.review_count, prof.full_name, prof.location, c.name,
      vm.variant_id, vm.variant_display_sku, vm.matched_code, vm.match_type
  )
  SELECT
    ranked.id,
    ranked.title,
    ranked.description,
    ranked.price,
    ranked.images,
    ranked.commission_rate,
    ranked.commission_type,
    ranked.flat_commission_amount,
    ranked.average_rating,
    ranked.review_count,
    ranked.seller_name,
    ranked.seller_location,
    ranked.category_name,
    ranked.tag_names,
    ranked.relevance_score,
    ranked.matched_variant_id,
    ranked.matched_variant_sku,
    ranked.matched_code,
    ranked.match_type
  FROM ranked
  ORDER BY
    CASE ranked.match_type
      WHEN 'exact_code' THEN 0
      WHEN 'partial_code' THEN 1
      WHEN 'text' THEN 2
      ELSE 3
    END,
    ranked.relevance_score DESC,
    ranked.id
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;
