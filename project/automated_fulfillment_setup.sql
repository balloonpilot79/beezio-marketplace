-- Automated Order Fulfillment Tables
-- Run this in your Supabase SQL Editor

-- Vendor Orders Table
CREATE TABLE IF NOT EXISTS vendor_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_order_id TEXT,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ordered',
  vendor_cost DECIMAL(10,2),
  shipping_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME_ZONE DEFAULT NOW()
);

-- Shipping Labels Table
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_order_id UUID REFERENCES vendor_orders(id),
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  shipping_cost DECIMAL(10,2),
  label_url TEXT,
  created_at TIMESTAMP WITH TIME_ZONE DEFAULT NOW()
);

-- Email Notifications Table
CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_type TEXT NOT NULL, -- 'buyer', 'seller', 'affiliate'
  email_type TEXT NOT NULL, -- 'order_confirmation', 'shipping_update', 'delivery_confirmation'
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME_ZONE,
  created_at TIMESTAMP WITH TIME_ZONE DEFAULT NOW()
);

-- Delivery Tracking Table
CREATE TABLE IF NOT EXISTS delivery_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  estimated_delivery TIMESTAMP WITH TIME_ZONE,
  actual_delivery TIMESTAMP WITH TIME_ZONE,
  last_updated TIMESTAMP WITH TIME_ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME_ZONE DEFAULT NOW()
);

-- Add fulfillment_status to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendor_orders_order_id ON vendor_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_status ON vendor_orders(status);
CREATE INDEX IF NOT EXISTS idx_shipping_labels_vendor_order_id ON shipping_labels(vendor_order_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_order_id ON email_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order_id ON delivery_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);

-- Enable Row Level Security
ALTER TABLE vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your user roles)
CREATE POLICY "Users can view their own vendor orders" ON vendor_orders
  FOR SELECT USING (auth.uid()::text = order_id);

CREATE POLICY "Users can view their own shipping labels" ON shipping_labels
  FOR SELECT USING (
    vendor_order_id IN (
      SELECT id FROM vendor_orders WHERE order_id = auth.uid()::text
    )
  );

-- Insert sample data for testing
INSERT INTO vendor_orders (order_id, vendor_name, product_id, quantity, status)
VALUES
  ('test-order-1', 'AliExpress', 'AE123456', 1, 'ordered'),
  ('test-order-2', 'Oberlo', 'OB789012', 2, 'processing')
ON CONFLICT DO NOTHING;
