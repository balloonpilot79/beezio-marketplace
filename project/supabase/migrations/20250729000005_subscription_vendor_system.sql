-- Enhanced subscription and vendor product system
-- Supports real vendor products and monthly subscriptions for powerhouse launch

-- Vendors table for real product suppliers
CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  description TEXT,
  website_url TEXT,
  contact_phone TEXT,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  commission_rate DECIMAL(5,2) DEFAULT 15.00, -- Default commission rate
  api_endpoint TEXT, -- For product sync
  api_key_hash TEXT, -- Encrypted API key
  sync_frequency INTEGER DEFAULT 24, -- Hours between syncs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced products table with subscription and vendor support
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id),
ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_interval TEXT CHECK (subscription_interval IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
ADD COLUMN IF NOT EXISTS subscription_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS trial_period_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS setup_fee DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_recurring_commission BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS subscription_description TEXT,
ADD COLUMN IF NOT EXISTS max_subscribers INTEGER,
ADD COLUMN IF NOT EXISTS current_subscribers INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS external_product_id TEXT, -- Vendor's product ID
ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Customer subscriptions table
CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  affiliate_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'cancelled', 'expired', 'trial')),
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_end TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  subscription_price DECIMAL(10,2) NOT NULL,
  setup_fee_paid DECIMAL(10,2) DEFAULT 0,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription billing history
CREATE TABLE IF NOT EXISTS subscription_billings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES customer_subscriptions(id),
  amount DECIMAL(10,2) NOT NULL,
  billing_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  stripe_invoice_id TEXT,
  affiliate_commission DECIMAL(10,2) DEFAULT 0,
  affiliate_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced affiliate commissions for recurring payments
ALTER TABLE affiliate_commissions 
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES customer_subscriptions(id),
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_cycle_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS commission_type TEXT CHECK (commission_type IN ('one_time', 'recurring', 'setup_fee'));

-- Product categories for better organization
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id),
  commission_rate_override DECIMAL(5,2), -- Category-specific commission
  is_subscription_category BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product category assignments
CREATE TABLE IF NOT EXISTS product_category_assignments (
  product_id UUID NOT NULL REFERENCES products(id),
  category_id UUID NOT NULL REFERENCES product_categories(id),
  PRIMARY KEY (product_id, category_id)
);

-- Vendor API sync logs
CREATE TABLE IF NOT EXISTS vendor_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('products', 'inventory', 'prices', 'full')),
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed', 'partial')),
  products_synced INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription analytics for affiliates
CREATE VIEW affiliate_subscription_analytics AS
SELECT 
  a.id as affiliate_id,
  a.full_name as affiliate_name,
  COUNT(cs.id) as total_subscriptions,
  COUNT(CASE WHEN cs.status = 'active' THEN 1 END) as active_subscriptions,
  COUNT(CASE WHEN cs.status = 'trial' THEN 1 END) as trial_subscriptions,
  SUM(CASE WHEN cs.status = 'active' THEN cs.subscription_price ELSE 0 END) as monthly_recurring_value,
  AVG(cs.subscription_price) as avg_subscription_value,
  COUNT(CASE WHEN cs.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_subscriptions_30d
FROM profiles a
LEFT JOIN customer_subscriptions cs ON a.id = cs.affiliate_id
WHERE a.role = 'affiliate'
GROUP BY a.id, a.full_name;

-- Product performance analytics
CREATE VIEW product_subscription_analytics AS
SELECT 
  p.id as product_id,
  p.title as product_name,
  p.subscription_price,
  p.commission_rate,
  COUNT(cs.id) as total_subscriptions,
  COUNT(CASE WHEN cs.status = 'active' THEN 1 END) as active_subscriptions,
  SUM(CASE WHEN cs.status = 'active' THEN cs.subscription_price ELSE 0 END) as monthly_revenue,
  AVG(EXTRACT(DAYS FROM (cs.updated_at - cs.created_at))) as avg_subscription_lifetime_days,
  (COUNT(CASE WHEN cs.status = 'active' THEN 1 END) * 100.0 / NULLIF(COUNT(cs.id), 0)) as retention_rate
FROM products p
LEFT JOIN customer_subscriptions cs ON p.id = cs.product_id
WHERE p.is_subscription = true
GROUP BY p.id, p.title, p.subscription_price, p.commission_rate;

-- Insert default product categories
INSERT INTO product_categories (name, slug, description, is_subscription_category, sort_order) VALUES
('Software & Apps', 'software-apps', 'Software applications and SaaS products', true, 1),
('Digital Marketing', 'digital-marketing', 'Marketing tools and services', true, 2),
('Education & Courses', 'education-courses', 'Online courses and educational content', true, 3),
('Health & Fitness', 'health-fitness', 'Health and fitness products and services', true, 4),
('Business Tools', 'business-tools', 'Business productivity and management tools', true, 5),
('Entertainment', 'entertainment', 'Streaming services and entertainment', true, 6),
('Physical Products', 'physical-products', 'Tangible goods and merchandise', false, 7),
('Services', 'services', 'Professional and personal services', false, 8);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_subscription ON products(is_subscription);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_status ON customer_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_customer_subscriptions_affiliate ON customer_subscriptions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_subscription_billings_date ON subscription_billings(billing_date);
CREATE INDEX IF NOT EXISTS idx_vendor_sync_logs_vendor ON vendor_sync_logs(vendor_id);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_category_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view verified vendors" ON vendors FOR SELECT USING (is_verified = true);
CREATE POLICY "Vendors can update own profile" ON vendors FOR UPDATE USING (auth.uid()::text = email);

CREATE POLICY "Users can view own subscriptions" ON customer_subscriptions FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Affiliates can view their subscriptions" ON customer_subscriptions FOR SELECT USING (auth.uid() = affiliate_id);

CREATE POLICY "Users can view own billing" ON subscription_billings FOR SELECT USING (
  EXISTS (SELECT 1 FROM customer_subscriptions cs WHERE cs.id = subscription_id AND cs.customer_id = auth.uid())
);

CREATE POLICY "Public can view categories" ON product_categories FOR SELECT TO PUBLIC USING (true);
CREATE POLICY "Public can view category assignments" ON product_category_assignments FOR SELECT TO PUBLIC USING (true);
