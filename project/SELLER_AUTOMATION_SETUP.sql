-- Seller Automation Settings Migration
-- Add automation preferences for individual sellers

-- Create seller_automation_settings table
CREATE TABLE IF NOT EXISTS seller_automation_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  auto_order_enabled BOOLEAN DEFAULT false,
  auto_payment_enabled BOOLEAN DEFAULT false,
  auto_inventory_enabled BOOLEAN DEFAULT false,
  auto_shipping_labels BOOLEAN DEFAULT false,
  auto_tracking_updates BOOLEAN DEFAULT false,
  auto_delivery_notifications BOOLEAN DEFAULT false,
  auto_order_confirmations BOOLEAN DEFAULT false,
  auto_shipping_updates BOOLEAN DEFAULT false,
  auto_delivery_alerts BOOLEAN DEFAULT false,
  auto_commission_payouts BOOLEAN DEFAULT false,
  vendor_api_keys JSONB DEFAULT '{}',
  shipping_provider TEXT,
  email_provider TEXT,
  automation_level TEXT DEFAULT 'basic', -- 'basic', 'advanced', 'premium'
  monthly_order_limit INTEGER DEFAULT 100,
  orders_processed_this_month INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(seller_id)
);

-- Create seller_automation_logs table for tracking automation activity
CREATE TABLE IF NOT EXISTS seller_automation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id TEXT,
  automation_type TEXT NOT NULL, -- 'order_placement', 'payment', 'shipping', 'email', etc.
  status TEXT NOT NULL, -- 'success', 'failed', 'pending'
  details JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create seller_automation_stats table for performance tracking
CREATE TABLE IF NOT EXISTS seller_automation_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- '2024-08'
  orders_automated INTEGER DEFAULT 0,
  orders_failed INTEGER DEFAULT 0,
  time_saved_hours DECIMAL(10,2) DEFAULT 0,
  cost_savings DECIMAL(10,2) DEFAULT 0,
  customer_satisfaction_score DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(seller_id, month_year)
);

-- Add automation_status to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS automated_by_seller UUID REFERENCES profiles(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_seller_automation_settings_seller_id ON seller_automation_settings(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_automation_logs_seller_id ON seller_automation_logs(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_automation_logs_created_at ON seller_automation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_seller_automation_stats_seller_id ON seller_automation_stats(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_automation_enabled ON orders(automation_enabled);

-- Enable Row Level Security
ALTER TABLE seller_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_automation_stats ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own automation settings" ON seller_automation_settings
  FOR ALL USING (auth.uid() = seller_id);

CREATE POLICY "Users can view their own automation logs" ON seller_automation_logs
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Users can view their own automation stats" ON seller_automation_stats
  FOR SELECT USING (auth.uid() = seller_id);

-- Insert sample data for testing
INSERT INTO seller_automation_settings (seller_id, auto_order_enabled, automation_level)
SELECT
  p.id,
  false,
  'basic'
FROM profiles p
WHERE p.role = 'seller'
ON CONFLICT (seller_id) DO NOTHING;

-- Create function to update automation stats
CREATE OR REPLACE FUNCTION update_seller_automation_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update monthly stats when a log entry is created
  INSERT INTO seller_automation_stats (seller_id, month_year, orders_automated, orders_failed)
  VALUES (
    NEW.seller_id,
    TO_CHAR(NOW(), 'YYYY-MM'),
    CASE WHEN NEW.status = 'success' AND NEW.automation_type = 'order_placement' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END
  )
  ON CONFLICT (seller_id, month_year)
  DO UPDATE SET
    orders_automated = seller_automation_stats.orders_automated + CASE WHEN NEW.status = 'success' AND NEW.automation_type = 'order_placement' THEN 1 ELSE 0 END,
    orders_failed = seller_automation_stats.orders_failed + CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automation stats
CREATE TRIGGER trigger_update_automation_stats
  AFTER INSERT ON seller_automation_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_automation_stats();

-- Create function to reset monthly counters
CREATE OR REPLACE FUNCTION reset_monthly_automation_counters()
RETURNS VOID AS $$
BEGIN
  -- Reset orders_processed_this_month for new month
  UPDATE seller_automation_settings
  SET orders_processed_this_month = 0
  WHERE EXTRACT(MONTH FROM updated_at) != EXTRACT(MONTH FROM NOW());
END;
$$ LANGUAGE plpgsql;
