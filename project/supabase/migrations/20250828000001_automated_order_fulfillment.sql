-- Automated Order Fulfillment System
-- Adds tables for vendor orders, shipping labels, delivery tracking, and email notifications

-- Create vendor_orders table
CREATE TABLE IF NOT EXISTS vendor_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL,
  vendor_order_id TEXT NOT NULL,
  items JSONB NOT NULL,
  shipping_address JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'processing', 'shipped', 'delivered', 'cancelled')),
  vendor_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shipping_labels table
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  vendor_order_id TEXT,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  estimated_delivery TIMESTAMPTZ,
  label_url TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'printed', 'shipped', 'delivered', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create delivery_tracking table
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_transit' CHECK (status IN ('in_transit', 'out_for_delivery', 'delivered', 'delayed', 'returned', 'cancelled')),
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  next_check TIMESTAMPTZ,
  tracking_events JSONB DEFAULT '[]',
  delivery_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create email_notifications table
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('buyer', 'seller', 'affiliate')),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('order_confirmation', 'shipping_confirmation', 'delivery_update', 'commission_paid')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  email_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vendor_products table to link products to vendors
CREATE TABLE IF NOT EXISTS vendor_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL,
  vendor_sku TEXT,
  vendor_price DECIMAL(10,2),
  vendor_stock_quantity INTEGER DEFAULT 0,
  last_synced TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'inactive', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add vendor information to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS vendor_id TEXT,
ADD COLUMN IF NOT EXISTS vendor_sku TEXT,
ADD COLUMN IF NOT EXISTS supplier_info JSONB;

-- Add tracking information to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS tracking_numbers TEXT[],
ADD COLUMN IF NOT EXISTS shipping_carrier TEXT,
ADD COLUMN IF NOT EXISTS estimated_delivery TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_orders_order_id ON vendor_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_status ON vendor_orders(status);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_order_id ON shipping_labels(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_tracking_number ON shipping_labels(tracking_number);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order_id ON delivery_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_tracking_number ON delivery_tracking(tracking_number);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_next_check ON delivery_tracking(next_check);
CREATE INDEX IF NOT EXISTS idx_email_notifications_order_id ON email_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_vendor_products_product_id ON vendor_products(product_id);
CREATE INDEX IF NOT EXISTS idx_vendor_products_vendor_id ON vendor_products(vendor_id);

-- Enable RLS
ALTER TABLE vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own vendor orders" ON vendor_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = vendor_orders.order_id
      AND orders.customer_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Sellers can view vendor orders for their products" ON vendor_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM order_items
      WHERE order_items.order_id = vendor_orders.order_id
      AND order_items.seller_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Users can view their own shipping labels" ON shipping_labels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = shipping_labels.order_id
      AND orders.customer_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can view their own delivery tracking" ON delivery_tracking
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = delivery_tracking.order_id
      AND orders.customer_email = auth.jwt() ->> 'email'
    )
  );

-- Functions for automated processing
CREATE OR REPLACE FUNCTION trigger_automated_fulfillment()
RETURNS TRIGGER AS $$
BEGIN
  -- Trigger automated fulfillment when order status changes to 'paid'
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    -- Call the automated fulfillment function
    PERFORM
      net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/automated-order-fulfillment',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object('orderId', NEW.id)::text
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS automated_fulfillment_trigger ON orders;
CREATE TRIGGER automated_fulfillment_trigger
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_automated_fulfillment();
