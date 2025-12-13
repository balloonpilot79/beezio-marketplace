-- COMPLETE ORDERS TABLE SETUP FOR BEEZIO
-- Ensures orders table has all fields needed by recordOrderWithPayouts()
-- Run this in Supabase SQL Editor BEFORE running AFFILIATE-RECRUITER-SYSTEM.sql

-- 1. Ensure orders table exists with all required fields
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  storefront_id UUID REFERENCES store_settings(id) ON DELETE SET NULL,
  affiliate_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Order amounts
  subtotal_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Commission tracking (rates at time of purchase)
  platform_percent_at_purchase DECIMAL(5,2) DEFAULT 15,
  fundraiser_percent_at_purchase DECIMAL(5,2) DEFAULT 0,
  affiliate_commission_percent_at_purchase DECIMAL(5,2),
  
  -- Order status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  
  -- Payment info
  stripe_payment_intent_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add missing columns if table already exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS storefront_id UUID REFERENCES store_settings(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform_percent_at_purchase DECIMAL(5,2) DEFAULT 15;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fundraiser_percent_at_purchase DECIMAL(5,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_commission_percent_at_purchase DECIMAL(5,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  final_sale_price_per_unit DECIMAL(10,2) NOT NULL,
  seller_ask_price_per_unit DECIMAL(10,2) NOT NULL,
  affiliate_commission_percent_at_purchase DECIMAL(5,2),
  platform_percent_at_purchase DECIMAL(5,2) DEFAULT 15,
  fundraiser_percent_at_purchase DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  beneficiary_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('seller', 'affiliate', 'referral_affiliate', 'fundraiser', 'beezio', 'stripe')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
CREATE POLICY "Users can create their own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Service role can manage all orders" ON orders;
CREATE POLICY "Service role can manage all orders" ON orders
  FOR ALL USING (auth.role() = 'service_role');

-- 7. RLS Policies for order_items
DROP POLICY IF EXISTS "Users can view items from their orders" ON order_items;
CREATE POLICY "Users can view items from their orders" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.buyer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can insert order items" ON order_items;
CREATE POLICY "Authenticated users can insert order items" ON order_items
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all order items" ON order_items;
CREATE POLICY "Service role can manage all order items" ON order_items
  FOR ALL USING (auth.role() = 'service_role');

-- 8. RLS Policies for payouts
DROP POLICY IF EXISTS "Users can view their own payouts" ON payouts;
CREATE POLICY "Users can view their own payouts" ON payouts
  FOR SELECT USING (
    beneficiary_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can insert payouts" ON payouts;
CREATE POLICY "Authenticated users can insert payouts" ON payouts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage all payouts" ON payouts;
CREATE POLICY "Service role can manage all payouts" ON payouts
  FOR ALL USING (auth.role() = 'service_role');

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_affiliate_id ON orders(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_payouts_order_id ON payouts(order_id);
CREATE INDEX IF NOT EXISTS idx_payouts_beneficiary_id ON payouts(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_payouts_role ON payouts(role);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- 10. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Create trigger for orders updated_at
DROP TRIGGER IF EXISTS set_orders_updated_at ON orders;
CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- SUCCESS!
-- =====================================================================
-- Orders System Ready!
-- 
-- ✅ orders table with all fields needed by recordOrderWithPayouts()
-- ✅ order_items table for line-item tracking
-- ✅ payouts table for commission distribution
-- ✅ RLS policies allow users to insert their own orders
-- ✅ Indexes for performance
-- ✅ Auto-updating updated_at timestamp
-- 
-- NEXT STEP: Run AFFILIATE-RECRUITER-SYSTEM.sql to enable referral commissions
