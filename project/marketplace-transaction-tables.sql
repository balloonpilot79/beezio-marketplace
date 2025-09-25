-- Additional tables for complete marketplace transaction testing

-- Affiliate clicks tracking
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  affiliate_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  stripe_payment_id TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace transactions (detailed payment breakdown)
CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  stripe_payment_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  seller_amount DECIMAL(10,2) NOT NULL,
  affiliate_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  affiliate_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payouts table (already exists but ensuring it's complete)
CREATE TABLE IF NOT EXISTS payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  stripe_transfer_id TEXT,
  description TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_affiliate_id ON affiliate_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_product_id ON affiliate_clicks(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_buyer_id ON purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_affiliate_id ON purchases(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- Row Level Security (RLS) policies
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Policies for affiliate_clicks
CREATE POLICY "Users can view their own affiliate clicks" ON affiliate_clicks
  FOR SELECT USING (auth.uid() = affiliate_id);

CREATE POLICY "Users can insert their own affiliate clicks" ON affiliate_clicks
  FOR INSERT WITH CHECK (auth.uid() = affiliate_id);

-- Policies for purchases
CREATE POLICY "Users can view their own purchases" ON purchases
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view purchases of their products" ON purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = purchases.product_id
      AND products.seller_id = auth.uid()
    )
  );

-- Policies for marketplace_transactions
CREATE POLICY "Sellers can view transactions for their products" ON marketplace_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchases p
      JOIN products pr ON pr.id = p.product_id
      WHERE p.id = marketplace_transactions.purchase_id
      AND pr.seller_id = auth.uid()
    )
  );

CREATE POLICY "Affiliates can view transactions for their referrals" ON marketplace_transactions
  FOR SELECT USING (auth.uid() = affiliate_id);

-- Policies for payouts
CREATE POLICY "Users can view their own payouts" ON payouts
  FOR SELECT USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();