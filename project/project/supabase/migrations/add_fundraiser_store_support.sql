-- Add Fundraiser Store Support with Auto-Subdomain Generation
-- This migration creates the fundraiser_store_settings table and integrates with the affiliate marketplace

-- Create fundraiser_store_settings table
CREATE TABLE IF NOT EXISTS fundraiser_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Store branding
  store_name TEXT NOT NULL,
  store_description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  
  -- Custom domain and subdomain
  custom_domain TEXT UNIQUE,
  subdomain TEXT UNIQUE,
  
  -- Fundraiser-specific fields
  fundraiser_goal DECIMAL(10,2) DEFAULT 0,
  current_raised DECIMAL(10,2) DEFAULT 0,
  goal_description TEXT,
  goal_deadline TIMESTAMPTZ,
  show_goal_on_store BOOLEAN DEFAULT true,
  
  -- Theming
  primary_color TEXT DEFAULT '#2563eb',
  secondary_color TEXT DEFAULT '#1e40af',
  text_color TEXT DEFAULT '#1f2937',
  
  -- Social links
  facebook_url TEXT,
  instagram_url TEXT,
  twitter_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_fundraiser_store_user_id ON fundraiser_store_settings(user_id);

-- Create index on custom_domain for custom domain routing
CREATE INDEX IF NOT EXISTS idx_fundraiser_store_custom_domain ON fundraiser_store_settings(custom_domain);

-- Create index on subdomain for subdomain routing
CREATE INDEX IF NOT EXISTS idx_fundraiser_store_subdomain ON fundraiser_store_settings(subdomain);

-- Create fundraiser_products junction table (fundraisers choose products from marketplace)
CREATE TABLE IF NOT EXISTS fundraiser_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  
  -- Custom settings per product (optional overrides)
  custom_description TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: fundraiser can't add same product twice
  UNIQUE(fundraiser_id, product_id)
);

-- Create indexes for fundraiser_products
CREATE INDEX IF NOT EXISTS idx_fundraiser_products_fundraiser ON fundraiser_products(fundraiser_id);
CREATE INDEX IF NOT EXISTS idx_fundraiser_products_product ON fundraiser_products(product_id);

-- Create or replace trigger function for auto-subdomain generation for fundraisers
-- Reuses the same generate_subdomain_from_email function already created in add_subdomain_support.sql
CREATE OR REPLACE FUNCTION auto_set_fundraiser_subdomain()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set subdomain if not already provided
  IF NEW.subdomain IS NULL OR NEW.subdomain = '' THEN
    -- Get email from auth.users
    SELECT generate_subdomain_from_email(email) INTO NEW.subdomain
    FROM auth.users
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate subdomain on INSERT
DROP TRIGGER IF EXISTS set_fundraiser_subdomain ON fundraiser_store_settings;
CREATE TRIGGER set_fundraiser_subdomain
  BEFORE INSERT ON fundraiser_store_settings
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_fundraiser_subdomain();

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fundraiser_store_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_fundraiser_store_timestamp ON fundraiser_store_settings;
CREATE TRIGGER update_fundraiser_store_timestamp
  BEFORE UPDATE ON fundraiser_store_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_fundraiser_store_updated_at();

-- Enable Row Level Security
ALTER TABLE fundraiser_store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fundraiser_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fundraiser_store_settings
-- Allow anyone to view active fundraiser stores (for public storefront)
CREATE POLICY "Anyone can view active fundraiser stores"
  ON fundraiser_store_settings FOR SELECT
  USING (is_active = true);

-- Allow fundraisers to view their own store settings (even if inactive)
CREATE POLICY "Fundraisers can view own store"
  ON fundraiser_store_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Allow fundraisers to insert their own store settings
CREATE POLICY "Fundraisers can create own store"
  ON fundraiser_store_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow fundraisers to update their own store settings
CREATE POLICY "Fundraisers can update own store"
  ON fundraiser_store_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow fundraisers to delete their own store settings
CREATE POLICY "Fundraisers can delete own store"
  ON fundraiser_store_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Allow admins to do everything
CREATE POLICY "Admins can manage all fundraiser stores"
  ON fundraiser_store_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- RLS Policies for fundraiser_products
-- Allow anyone to view products in active fundraiser stores
CREATE POLICY "Anyone can view fundraiser products"
  ON fundraiser_products FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM fundraiser_store_settings
      WHERE fundraiser_store_settings.user_id = fundraiser_products.fundraiser_id
      AND fundraiser_store_settings.is_active = true
    )
  );

-- Allow fundraisers to view their own products
CREATE POLICY "Fundraisers can view own products"
  ON fundraiser_products FOR SELECT
  USING (auth.uid() = fundraiser_id);

-- Allow fundraisers to add products to their store
CREATE POLICY "Fundraisers can add products"
  ON fundraiser_products FOR INSERT
  WITH CHECK (auth.uid() = fundraiser_id);

-- Allow fundraisers to update their product selections
CREATE POLICY "Fundraisers can update own products"
  ON fundraiser_products FOR UPDATE
  USING (auth.uid() = fundraiser_id)
  WITH CHECK (auth.uid() = fundraiser_id);

-- Allow fundraisers to remove products from their store
CREATE POLICY "Fundraisers can delete own products"
  ON fundraiser_products FOR DELETE
  USING (auth.uid() = fundraiser_id);

-- Allow admins to manage all fundraiser products
CREATE POLICY "Admins can manage all fundraiser products"
  ON fundraiser_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Add fundraiser role to user_roles if it doesn't exist
-- This ensures the fundraiser role is available in the system
INSERT INTO user_roles (user_id, role)
SELECT DISTINCT user_id, 'fundraiser'
FROM fundraiser_store_settings
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = fundraiser_store_settings.user_id
  AND user_roles.role = 'fundraiser'
);

-- Comment on tables for documentation
COMMENT ON TABLE fundraiser_store_settings IS 'Stores fundraiser store configurations including goals, branding, and custom domains';
COMMENT ON TABLE fundraiser_products IS 'Junction table linking fundraisers to products they promote from the marketplace';
COMMENT ON COLUMN fundraiser_store_settings.subdomain IS 'Auto-generated subdomain from email (e.g., jason.beezio.co)';
COMMENT ON COLUMN fundraiser_store_settings.custom_domain IS 'User-provided custom domain (e.g., mystore.com)';
COMMENT ON COLUMN fundraiser_store_settings.fundraiser_goal IS 'Fundraising goal amount in dollars';
COMMENT ON COLUMN fundraiser_store_settings.current_raised IS 'Current amount raised towards goal';
