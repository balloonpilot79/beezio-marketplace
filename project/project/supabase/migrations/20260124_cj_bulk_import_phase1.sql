-- CJ bulk import phase 1: staging, mapping, pricing, shipping, inventory, audit

-- 1) Raw CJ staging (optional but preferred)
CREATE TABLE IF NOT EXISTS public.cj_products (
  cj_product_id text PRIMARY KEY,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Category mapping
CREATE TABLE IF NOT EXISTS public.category_map_cj_to_beezio (
  cj_category_path text PRIMARY KEY,
  beezio_category_id uuid REFERENCES public.categories(id),
  fallback boolean NOT NULL DEFAULT false
);

-- 3) Category pricing defaults
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  beezio_category_id uuid PRIMARY KEY REFERENCES public.categories(id),
  affiliate_percent int NOT NULL DEFAULT 20,
  affiliate_floor_cents int NOT NULL DEFAULT 500,
  affiliate_enabled boolean NOT NULL DEFAULT true,
  markup_type text NOT NULL DEFAULT 'flat',
  markup_value int NOT NULL DEFAULT 800,
  paypal_fee_bps int NOT NULL DEFAULT 350,
  paypal_fixed_cents int NOT NULL DEFAULT 65
);

-- 4) Shipping rules
CREATE TABLE IF NOT EXISTS public.shipping_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL DEFAULT 'default',
  tiers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default shipping tiers if missing
INSERT INTO public.shipping_rules (name, tiers_json)
SELECT
  'default',
  '[
    {"min_oz":0, "max_oz":8, "shipping_cents":499},
    {"min_oz":9, "max_oz":32, "shipping_cents":699},
    {"min_oz":33, "max_oz":80, "shipping_cents":999},
    {"min_oz":81, "max_oz":160, "shipping_cents":1499},
    {"min_oz":161, "max_oz":999999, "shipping_cents":1999}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipping_rules WHERE name = 'default'
);

-- 5) Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) Products extensions (CJ + pricing snapshot + inventory)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cj_product_id text,
  ADD COLUMN IF NOT EXISTS beezio_category_id uuid REFERENCES public.categories(id),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS primary_image_url text,
  ADD COLUMN IF NOT EXISTS base_weight_oz int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_cost_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retail_price_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_estimate_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affiliate_percent int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affiliate_floor_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_type text NOT NULL DEFAULT 'flat',
  ADD COLUMN IF NOT EXISTS markup_value int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paypal_fee_bps int NOT NULL DEFAULT 350,
  ADD COLUMN IF NOT EXISTS paypal_fixed_cents int NOT NULL DEFAULT 65,
  ADD COLUMN IF NOT EXISTS track_inventory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_inventory int NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_cj_product_id_unique ON public.products(cj_product_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_status_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_status_check CHECK (status IN ('draft','active','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_markup_type_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_markup_type_check CHECK (markup_type IN ('flat','percent'));
  END IF;
END $$;

-- 7) Variants extensions (pricing snapshot + inventory)
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS option1_name text,
  ADD COLUMN IF NOT EXISTS option1_value text,
  ADD COLUMN IF NOT EXISTS option2_name text,
  ADD COLUMN IF NOT EXISTS option2_value text,
  ADD COLUMN IF NOT EXISTS option3_name text,
  ADD COLUMN IF NOT EXISTS option3_value text,
  ADD COLUMN IF NOT EXISTS weight_oz int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retail_price_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inventory_policy text NOT NULL DEFAULT 'deny',
  ADD COLUMN IF NOT EXISTS in_stock boolean NOT NULL DEFAULT true;

ALTER TABLE public.product_variants
  ALTER COLUMN inventory SET DEFAULT 0;

UPDATE public.product_variants
  SET inventory = 0
WHERE inventory IS NULL;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.product_variants
      ALTER COLUMN inventory SET NOT NULL;
  EXCEPTION
    WHEN others THEN
      -- leave nullable if existing data prevents change
      NULL;
  END;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_inventory_policy_check') THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_inventory_policy_check CHECK (inventory_policy IN ('deny','continue'));
  END IF;
END $$;

-- 8) updated_at triggers
DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON public.product_variants;
CREATE TRIGGER trg_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_shipping_rules_updated_at ON public.shipping_rules;
CREATE TRIGGER trg_shipping_rules_updated_at
  BEFORE UPDATE ON public.shipping_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) RLS
ALTER TABLE public.cj_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_map_cj_to_beezio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- 10) Policies
DROP POLICY IF EXISTS admin_all_cj_products ON public.cj_products;
CREATE POLICY admin_all_cj_products
  ON public.cj_products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  );

DROP POLICY IF EXISTS admin_all_category_map ON public.category_map_cj_to_beezio;
CREATE POLICY admin_all_category_map
  ON public.category_map_cj_to_beezio
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  );

DROP POLICY IF EXISTS admin_all_pricing_rules ON public.pricing_rules;
CREATE POLICY admin_all_pricing_rules
  ON public.pricing_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  );

DROP POLICY IF EXISTS admin_all_shipping_rules ON public.shipping_rules;
CREATE POLICY admin_all_shipping_rules
  ON public.shipping_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  );

DROP POLICY IF EXISTS admin_all_audit_log ON public.audit_log;
CREATE POLICY admin_all_audit_log
  ON public.audit_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  );

DROP POLICY IF EXISTS products_public_read_active_in_stock ON public.products;
CREATE POLICY products_public_read_active_in_stock
  ON public.products
  FOR SELECT
  USING (
    COALESCE(status, 'draft') = 'active'
    AND COALESCE(is_active, true) = true
    AND COALESCE(in_stock, true) = true
  );

DROP POLICY IF EXISTS products_admin_all ON public.products;
CREATE POLICY products_admin_all
  ON public.products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  );

DROP POLICY IF EXISTS variants_public_read_active_in_stock ON public.product_variants;
CREATE POLICY variants_public_read_active_in_stock
  ON public.product_variants
  FOR SELECT
  USING (
    is_active = true
    AND COALESCE(in_stock, true) = true
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
        AND COALESCE(p.status, 'draft') = 'active'
        AND COALESCE(p.is_active, true) = true
        AND COALESCE(p.in_stock, true) = true
    )
  );

DROP POLICY IF EXISTS variants_admin_all ON public.product_variants;
CREATE POLICY variants_admin_all
  ON public.product_variants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.user_id = auth.uid() OR p.id = auth.uid())
        AND (p.role = 'admin' OR p.primary_role = 'admin')
    )
  );
