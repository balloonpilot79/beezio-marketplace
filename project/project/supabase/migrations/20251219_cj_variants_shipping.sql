-- CJ Variants + Shipping (bee expansion)
-- Ensures the CJ dropshipping schema exists

-- 1. Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'CJ',
    cj_product_id text NOT NULL,
    cj_variant_id text NOT NULL,
    sku text NOT NULL,
    price numeric NOT NULL,
    compare_at_price numeric,
    currency text NOT NULL DEFAULT 'USD',
    image_url text,
    attributes jsonb,
    inventory integer,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_cj_variant_id ON product_variants(cj_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_cj_variant_unique ON product_variants(cj_variant_id);

-- 2. Shipping Options
CREATE TABLE IF NOT EXISTS shipping_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    variant_id uuid NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'CJ',
    destination_country text NOT NULL,
    method_code text NOT NULL,
    method_name text NOT NULL,
    cost numeric NOT NULL DEFAULT 0,
    min_days integer,
    max_days integer,
    processing_days integer,
    last_quoted_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shipping_options_product_country ON shipping_options(product_id, destination_country);
CREATE INDEX IF NOT EXISTS idx_shipping_options_variant_country ON shipping_options(variant_id, destination_country);
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipping_options_unique_method ON shipping_options(product_id, destination_country, method_code, variant_id);

-- 3. Orders table extensions (safe to run multiple times)
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES storefronts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status text,
    ADD COLUMN IF NOT EXISTS shipping_option_id uuid REFERENCES shipping_options(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS shipping_total numeric,
    ADD COLUMN IF NOT EXISTS currency text,
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
    ADD COLUMN IF NOT EXISTS cj_order_id text,
    ADD COLUMN IF NOT EXISTS cj_tracking_number text,
    ADD COLUMN IF NOT EXISTS cj_tracking_url text,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_orders_affiliate_id ON orders(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_option_id ON orders(shipping_option_id);

-- 4. Order items enhancements
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES product_variants(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS shipping_option_id uuid REFERENCES shipping_options(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cj_product_id text,
    ADD COLUMN IF NOT EXISTS cj_variant_id text,
    ADD COLUMN IF NOT EXISTS sku text,
    ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shipping_option_id ON order_items(shipping_option_id);
