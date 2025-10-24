-- ========================================
-- AUTOMATED FULFILLMENT TRIGGERS
-- Run this in Supabase SQL Editor
-- ========================================

-- This trigger automatically fulfills orders when they're created/paid

-- 1. Create function to trigger auto-fulfillment
CREATE OR REPLACE FUNCTION trigger_auto_fulfillment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for paid orders
  IF NEW.payment_status = 'paid' AND NEW.fulfillment_status = 'pending' THEN
    -- Call Edge Function to fulfill order (non-blocking)
    PERFORM
      net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/auto-fulfill-order',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
        ),
        body := jsonb_build_object('order_id', NEW.id)
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger on orders table
DROP TRIGGER IF EXISTS auto_fulfill_order_trigger ON orders;

CREATE TRIGGER auto_fulfill_order_trigger
  AFTER INSERT OR UPDATE OF payment_status
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_fulfillment();

-- 3. Create function to check tracking updates (runs periodically)
CREATE OR REPLACE FUNCTION check_tracking_updates()
RETURNS void AS $$
BEGIN
  -- Call Edge Function to sync tracking
  PERFORM
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/sync-tracking',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Set up periodic tracking sync using pg_cron (if available)
-- This checks tracking every hour
-- Note: pg_cron extension must be enabled in Supabase dashboard first

-- SELECT cron.schedule(
--   'sync-tracking-hourly',
--   '0 * * * *',  -- Every hour
--   $$ SELECT check_tracking_updates(); $$
-- );

-- 5. Add api_connections table if not exists (for API integrations)
CREATE TABLE IF NOT EXISTS api_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'printful', 'printify', 'shopify', 'custom'
  api_key TEXT NOT NULL,
  store_id TEXT,
  webhook_url TEXT,
  status TEXT NOT NULL DEFAULT 'connected', -- 'connected', 'disconnected', 'error'
  last_sync TIMESTAMPTZ DEFAULT NOW(),
  products_synced INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable RLS on api_connections
ALTER TABLE api_connections ENABLE ROW LEVEL SECURITY;

-- 7. Create policy for sellers to manage their own connections
CREATE POLICY "Sellers can view own connections" ON api_connections
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert own connections" ON api_connections
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own connections" ON api_connections
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own connections" ON api_connections
  FOR DELETE USING (auth.uid() = seller_id);

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_connections_seller_id ON api_connections(seller_id);
CREATE INDEX IF NOT EXISTS idx_api_connections_provider ON api_connections(provider);
CREATE INDEX IF NOT EXISTS idx_api_connections_status ON api_connections(status);

-- ========================================
-- CONFIGURATION SETTINGS
-- ========================================

-- Set these in Supabase Dashboard → Settings → API
-- Or using SQL:

-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_service_role_key = 'your-service-role-key';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check if trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'auto_fulfill_order_trigger';

-- Check api_connections table
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'api_connections'
ORDER BY ordinal_position;

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '✅ AUTOMATED FULFILLMENT SYSTEM READY!';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 WHAT HAPPENS NOW:';
  RAISE NOTICE '   1. Customer pays → Order created';
  RAISE NOTICE '   2. Trigger fires → auto-fulfill-order function called';
  RAISE NOTICE '   3. System places order with supplier automatically';
  RAISE NOTICE '   4. Tracking syncs hourly → updates order status';
  RAISE NOTICE '   5. Customer gets email with tracking → delivered!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '   1. Deploy Edge Functions in Supabase Dashboard';
  RAISE NOTICE '   2. Add API keys for suppliers (Printful, Printify, etc.)';
  RAISE NOTICE '   3. Configure email provider (Resend API key)';
  RAISE NOTICE '   4. Test with a real order!';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 EDGE FUNCTIONS TO DEPLOY:';
  RAISE NOTICE '   • auto-fulfill-order - Places orders with suppliers';
  RAISE NOTICE '   • sync-external-products - Imports products from APIs';
  RAISE NOTICE '   • sync-tracking - Updates tracking from suppliers';
  RAISE NOTICE '   • send-notifications - Sends emails to customers';
  RAISE NOTICE '';
END $$;
