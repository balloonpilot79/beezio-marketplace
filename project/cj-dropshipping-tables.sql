-- CJ Dropshipping Integration Tables
-- Run this in your Supabase SQL editor

-- Table to track CJ product mappings
CREATE TABLE IF NOT EXISTS cj_product_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beezio_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cj_product_id TEXT NOT NULL,
  cj_product_sku TEXT NOT NULL,
  cj_variant_id TEXT,
  cj_cost DECIMAL(10, 2) NOT NULL,
  markup_percent DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  affiliate_commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
  price_breakdown JSONB,
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cj_product_id, cj_variant_id)
);

-- Table to track CJ orders
CREATE TABLE IF NOT EXISTS cj_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beezio_order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  cj_order_number TEXT NOT NULL UNIQUE,
  cj_order_id TEXT,
  cj_status TEXT DEFAULT 'pending',
  cj_tracking_number TEXT,
  cj_logistic_name TEXT,
  cj_tracking_url TEXT,
  cj_cost DECIMAL(10, 2),
  order_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(beezio_order_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cj_products_beezio_id ON cj_product_mappings(beezio_product_id);
CREATE INDEX IF NOT EXISTS idx_cj_products_cj_id ON cj_product_mappings(cj_product_id);
CREATE INDEX IF NOT EXISTS idx_cj_orders_beezio_id ON cj_orders(beezio_order_id);
CREATE INDEX IF NOT EXISTS idx_cj_orders_cj_number ON cj_orders(cj_order_number);
CREATE INDEX IF NOT EXISTS idx_cj_orders_status ON cj_orders(cj_status);

-- Add columns to products table to track dropship info
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS dropship_provider TEXT,
ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_promotable BOOLEAN DEFAULT true;

-- Update trigger for cj_product_mappings
CREATE OR REPLACE FUNCTION update_cj_mapping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cj_mapping_timestamp
BEFORE UPDATE ON cj_product_mappings
FOR EACH ROW
EXECUTE FUNCTION update_cj_mapping_timestamp();

-- Update trigger for cj_orders
CREATE OR REPLACE FUNCTION update_cj_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cj_order_timestamp
BEFORE UPDATE ON cj_orders
FOR EACH ROW
EXECUTE FUNCTION update_cj_order_timestamp();

-- Enable RLS
ALTER TABLE cj_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cj_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cj_product_mappings
CREATE POLICY "Allow sellers to view their own CJ mappings"
ON cj_product_mappings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = cj_product_mappings.beezio_product_id 
    AND products.seller_id = auth.uid()
  )
);

CREATE POLICY "Allow sellers to insert CJ mappings for their products"
ON cj_product_mappings FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = cj_product_mappings.beezio_product_id 
    AND products.seller_id = auth.uid()
  )
);

CREATE POLICY "Allow sellers to update their CJ mappings"
ON cj_product_mappings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = cj_product_mappings.beezio_product_id 
    AND products.seller_id = auth.uid()
  )
);

-- RLS Policies for cj_orders
CREATE POLICY "Allow users to view their own CJ orders"
ON cj_orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = cj_orders.beezio_order_id 
    AND orders.buyer_id = auth.uid()
  )
);

CREATE POLICY "Allow service role to manage CJ orders"
ON cj_orders FOR ALL
USING (true)
WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE cj_product_mappings IS 'Maps Beezio products to CJ Dropshipping products for fulfillment';
COMMENT ON TABLE cj_orders IS 'Tracks orders sent to CJ Dropshipping for fulfillment';
COMMENT ON COLUMN cj_product_mappings.price_breakdown IS 'JSON containing: cjCost, yourProfit, affiliateCommission, beezioFee, stripeFee, finalPrice';
COMMENT ON COLUMN cj_orders.order_data IS 'Complete order payload sent to CJ API';
