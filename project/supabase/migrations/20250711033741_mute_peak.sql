/*
  # Platform Updates for Beezio

  1. New Tables
    - `affiliate_stores` - Individual stores for affiliates and sellers
    - `affiliate_store_products` - Many-to-many relationship between stores and products
    - `store_visits` - Track store visits and analytics

  2. Schema Updates
    - Add commission type flexibility to products (percentage or flat rate)
    - Add shipping cost fields
    - Update existing tables with new features

  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for store management
    - Ensure proper access control
*/

-- Create enum for commission types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_type') THEN
    CREATE TYPE commission_type AS ENUM ('percentage', 'flat_rate');
  END IF;
END $$;

-- Update products table with new commission and shipping features
DO $$
BEGIN
  -- Add commission_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'commission_type'
  ) THEN
    ALTER TABLE products ADD COLUMN commission_type commission_type DEFAULT 'percentage';
  END IF;

  -- Add flat_commission_amount column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'flat_commission_amount'
  ) THEN
    ALTER TABLE products ADD COLUMN flat_commission_amount numeric(10,2) DEFAULT 0;
  END IF;

  -- Add shipping_cost column if it doesn't exist (update existing one)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'shipping_cost'
  ) THEN
    ALTER TABLE products ADD COLUMN shipping_cost numeric(8,2) DEFAULT 0;
  END IF;

  -- Add unique_slug column for product URLs
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'unique_slug'
  ) THEN
    ALTER TABLE products ADD COLUMN unique_slug text UNIQUE;
  END IF;
END $$;

-- Create affiliate stores table
CREATE TABLE IF NOT EXISTS affiliate_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  store_name text NOT NULL,
  store_slug text UNIQUE NOT NULL,
  description text,
  logo_url text,
  banner_url text,
  custom_domain text,
  is_active boolean DEFAULT true,
  theme_color text DEFAULT '#f59e0b',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create affiliate store products junction table
CREATE TABLE IF NOT EXISTS affiliate_store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES affiliate_stores(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE(store_id, product_id)
);

-- Create store visits tracking table
CREATE TABLE IF NOT EXISTS store_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES affiliate_stores(id) ON DELETE CASCADE NOT NULL,
  visitor_ip text,
  user_agent text,
  referrer text,
  visited_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE affiliate_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_visits ENABLE ROW LEVEL SECURITY;

-- Policies for affiliate_stores
CREATE POLICY "Stores are viewable by everyone" ON affiliate_stores
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage own stores" ON affiliate_stores
  FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Policies for affiliate_store_products
CREATE POLICY "Store products are viewable by everyone" ON affiliate_store_products
  FOR SELECT USING (
    store_id IN (SELECT id FROM affiliate_stores WHERE is_active = true)
  );

CREATE POLICY "Store owners can manage store products" ON affiliate_store_products
  FOR ALL USING (
    store_id IN (
      SELECT id FROM affiliate_stores 
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Policies for store_visits
CREATE POLICY "Store owners can view own store visits" ON store_visits
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM affiliate_stores 
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Anyone can insert store visits" ON store_visits
  FOR INSERT WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_affiliate_stores_profile_id ON affiliate_stores(profile_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_stores_slug ON affiliate_stores(store_slug);
CREATE INDEX IF NOT EXISTS idx_affiliate_store_products_store_id ON affiliate_store_products(store_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_store_products_product_id ON affiliate_store_products(product_id);
CREATE INDEX IF NOT EXISTS idx_store_visits_store_id ON store_visits(store_id);
CREATE INDEX IF NOT EXISTS idx_products_unique_slug ON products(unique_slug);

-- Function to generate unique product slugs
CREATE OR REPLACE FUNCTION generate_product_slug(product_name text, product_id uuid)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Create base slug from product name
  base_slug := lower(regexp_replace(product_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- Ensure slug is not empty
  IF base_slug = '' THEN
    base_slug := 'product';
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and append counter if needed
  WHILE EXISTS (SELECT 1 FROM products WHERE unique_slug = final_slug AND id != product_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique store slugs
CREATE OR REPLACE FUNCTION generate_store_slug(store_name text, store_id uuid)
RETURNS text AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
BEGIN
  -- Create base slug from store name
  base_slug := lower(regexp_replace(store_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- Ensure slug is not empty
  IF base_slug = '' THEN
    base_slug := 'store';
  END IF;
  
  final_slug := base_slug;
  
  -- Check for uniqueness and append counter if needed
  WHILE EXISTS (SELECT 1 FROM affiliate_stores WHERE store_slug = final_slug AND id != store_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate product slugs
CREATE OR REPLACE FUNCTION set_product_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.unique_slug IS NULL OR NEW.unique_slug = '' THEN
    NEW.unique_slug := generate_product_slug(NEW.title, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_product_slug
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_product_slug();

-- Trigger to auto-generate store slugs
CREATE OR REPLACE FUNCTION set_store_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.store_slug IS NULL OR NEW.store_slug = '' THEN
    NEW.store_slug := generate_store_slug(NEW.store_name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_store_slug
  BEFORE INSERT OR UPDATE ON affiliate_stores
  FOR EACH ROW
  EXECUTE FUNCTION set_store_slug();