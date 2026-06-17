-- Ensure store customization tables/columns and RLS policies align with current UI expectations.

-- Create affiliate_store_settings if missing (profile-based ids).
CREATE TABLE IF NOT EXISTS public.affiliate_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_name TEXT,
  store_description TEXT,
  store_banner TEXT,
  store_logo TEXT,
  store_theme TEXT DEFAULT 'modern',
  custom_domain TEXT,
  subdomain TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  favorite_categories TEXT[] DEFAULT '{}'::text[],
  commission_goal NUMERIC,
  template_id TEXT DEFAULT 'modern-grid',
  product_page_template TEXT DEFAULT 'product-detailed',
  layout_config JSONB DEFAULT '{
    "header_style": "banner",
    "product_grid": "4-col",
    "sidebar": false,
    "footer_style": "detailed",
    "grid_layout": "standard"
  }'::jsonb,
  color_scheme JSONB DEFAULT '{
    "primary": "#f59e0b",
    "secondary": "#3b82f6",
    "accent": "#ef4444",
    "background": "#ffffff",
    "text": "#1f2937"
  }'::jsonb,
  custom_css TEXT,
  custom_html_header TEXT,
  custom_html_footer TEXT,
  contact_page_enabled BOOLEAN DEFAULT true,
  contact_email TEXT,
  business_hours TEXT,
  shipping_policy TEXT,
  return_policy TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (affiliate_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_settings') THEN
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS subdomain TEXT;
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'modern-grid';
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS product_page_template TEXT DEFAULT 'product-detailed';
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{
      "header_style": "banner",
      "product_grid": "4-col",
      "sidebar": false,
      "footer_style": "detailed",
      "grid_layout": "standard"
    }'::jsonb;
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS color_scheme JSONB DEFAULT '{
      "primary": "#f59e0b",
      "secondary": "#3b82f6",
      "accent": "#ef4444",
      "background": "#ffffff",
      "text": "#1f2937"
    }'::jsonb;
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS custom_css TEXT;
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS custom_html_header TEXT;
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS custom_html_footer TEXT;
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS contact_page_enabled BOOLEAN DEFAULT true;
    ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS contact_email TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings') THEN
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS store_description TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS store_banner TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS store_logo TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS store_theme TEXT DEFAULT 'modern';
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS custom_domain TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS subdomain TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS favorite_categories TEXT[] DEFAULT '{}'::text[];
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS commission_goal NUMERIC;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'modern-grid';
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS product_page_template TEXT DEFAULT 'product-detailed';
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{
      "header_style": "banner",
      "product_grid": "4-col",
      "sidebar": false,
      "footer_style": "detailed",
      "grid_layout": "standard"
    }'::jsonb;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS color_scheme JSONB DEFAULT '{
      "primary": "#f59e0b",
      "secondary": "#3b82f6",
      "accent": "#ef4444",
      "background": "#ffffff",
      "text": "#1f2937"
    }'::jsonb;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS custom_css TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS custom_html_header TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS custom_html_footer TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS contact_page_enabled BOOLEAN DEFAULT true;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS contact_email TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS business_hours TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS shipping_policy TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS return_policy TEXT;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    ALTER TABLE public.affiliate_store_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Backfill legacy affiliate column names into new store_* columns when present.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings' AND column_name = 'description')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings' AND column_name = 'store_description') THEN
    EXECUTE 'UPDATE public.affiliate_store_settings SET store_description = COALESCE(store_description, description) WHERE store_description IS NULL AND description IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings' AND column_name = 'banner_url')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings' AND column_name = 'store_banner') THEN
    EXECUTE 'UPDATE public.affiliate_store_settings SET store_banner = COALESCE(store_banner, banner_url) WHERE store_banner IS NULL AND banner_url IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings' AND column_name = 'logo_url')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings' AND column_name = 'store_logo') THEN
    EXECUTE 'UPDATE public.affiliate_store_settings SET store_logo = COALESCE(store_logo, logo_url) WHERE store_logo IS NULL AND logo_url IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings' AND column_name = 'theme')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings' AND column_name = 'store_theme') THEN
    EXECUTE 'UPDATE public.affiliate_store_settings SET store_theme = COALESCE(store_theme, theme) WHERE store_theme IS NULL AND theme IS NOT NULL';
  END IF;
END $$;

-- Unique indexes for domain/subdomain lookups.
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_subdomain
  ON public.store_settings (subdomain)
  WHERE subdomain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_settings_custom_domain
  ON public.store_settings (custom_domain)
  WHERE custom_domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_store_settings_subdomain
  ON public.affiliate_store_settings (subdomain)
  WHERE subdomain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_store_settings_custom_domain
  ON public.affiliate_store_settings (custom_domain)
  WHERE custom_domain IS NOT NULL;

-- Keep affiliate_store_settings updated_at in sync.
CREATE OR REPLACE FUNCTION public.update_affiliate_store_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_affiliate_store_settings_updated_at ON public.affiliate_store_settings;
CREATE TRIGGER update_affiliate_store_settings_updated_at
  BEFORE UPDATE ON public.affiliate_store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliate_store_settings_updated_at();

-- Custom pages + product ordering tables (required for store customization).
CREATE TABLE IF NOT EXISTS public.custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('seller', 'affiliate')),
  page_slug VARCHAR(100) NOT NULL,
  page_title VARCHAR(200) NOT NULL,
  page_content TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (owner_id, page_slug)
);

CREATE TABLE IF NOT EXISTS public.seller_product_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (seller_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (affiliate_id, product_id)
);

ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_product_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_store_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_settings') THEN
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'store_settings'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.store_settings;', pol.policyname);
    END LOOP;

    CREATE POLICY "Users can view own store settings" ON public.store_settings
      FOR SELECT
      TO authenticated
      USING (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can insert own store settings" ON public.store_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own store settings" ON public.store_settings
      FOR UPDATE
      TO authenticated
      USING (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can delete own store settings" ON public.store_settings
      FOR DELETE
      TO authenticated
      USING (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    BEGIN
      CREATE POLICY "Anyone can view store settings for public stores" ON public.store_settings
        FOR SELECT
        TO public
        USING (true);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'affiliate_store_settings') THEN
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_store_settings'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.affiliate_store_settings;', pol.policyname);
    END LOOP;

    CREATE POLICY "Users can view own affiliate store settings" ON public.affiliate_store_settings
      FOR SELECT
      TO authenticated
      USING (
        affiliate_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = affiliate_store_settings.affiliate_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can insert own affiliate store settings" ON public.affiliate_store_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        affiliate_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = affiliate_store_settings.affiliate_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own affiliate store settings" ON public.affiliate_store_settings
      FOR UPDATE
      TO authenticated
      USING (
        affiliate_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = affiliate_store_settings.affiliate_id
            AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        affiliate_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = affiliate_store_settings.affiliate_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can delete own affiliate store settings" ON public.affiliate_store_settings
      FOR DELETE
      TO authenticated
      USING (
        affiliate_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = affiliate_store_settings.affiliate_id
            AND p.user_id = auth.uid()
        )
      );

    BEGIN
      CREATE POLICY "Anyone can view affiliate store settings" ON public.affiliate_store_settings
        FOR SELECT
        TO public
        USING (true);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_pages') THEN
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_pages'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.custom_pages;', pol.policyname);
    END LOOP;

    CREATE POLICY "Users can view their own pages" ON public.custom_pages
      FOR SELECT
      USING (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = owner_id AND p.user_id = auth.uid())
      );

    CREATE POLICY "Public can view active pages" ON public.custom_pages
      FOR SELECT
      USING (is_active = true);

    CREATE POLICY "Users can manage their own pages" ON public.custom_pages
      FOR ALL
      USING (
        owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = owner_id AND p.user_id = auth.uid())
      );
  END IF;
END $$;

DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seller_product_order') THEN
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'seller_product_order'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.seller_product_order;', pol.policyname);
    END LOOP;

    CREATE POLICY "Sellers can manage their product order" ON public.seller_product_order
      FOR ALL
      USING (
        seller_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = seller_id AND p.user_id = auth.uid())
      );

    CREATE POLICY "Public can view product order" ON public.seller_product_order
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'affiliate_products') THEN
    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'affiliate_products'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.affiliate_products;', pol.policyname);
    END LOOP;

    CREATE POLICY "Affiliates can manage their products" ON public.affiliate_products
      FOR ALL
      USING (
        affiliate_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = affiliate_id AND p.user_id = auth.uid())
      );

    CREATE POLICY "Public can view affiliate products" ON public.affiliate_products
      FOR SELECT
      USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_custom_pages_owner ON public.custom_pages(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_custom_pages_slug ON public.custom_pages(page_slug);
CREATE INDEX IF NOT EXISTS idx_seller_product_order ON public.seller_product_order(seller_id, display_order);
CREATE INDEX IF NOT EXISTS idx_affiliate_products ON public.affiliate_products(affiliate_id, display_order);
