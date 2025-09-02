-- Safe migration to add payment distribution tables if they don't exist
-- This file can be run multiple times without issues

-- Add columns to profiles table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_account_id') THEN
        ALTER TABLE profiles ADD COLUMN stripe_account_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id') THEN
        ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT;
    END IF;
END $$;

-- Create orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  stripe_payment_intent_id TEXT UNIQUE,
  billing_name TEXT,
  billing_email TEXT,
  order_items JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  stripe_payment_intent_id TEXT UNIQUE,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment distributions table if it doesn't exist
CREATE TABLE IF NOT EXISTS payment_distributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  recipient_type TEXT NOT NULL, -- 'seller', 'affiliate', 'platform'
  recipient_id UUID, -- user ID for seller/affiliate, null for platform
  amount DECIMAL(10,2) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed
  stripe_transfer_id TEXT, -- Stripe transfer ID when paid
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Create user earnings table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_earnings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  role TEXT NOT NULL, -- 'seller', 'affiliate'
  total_earned DECIMAL(10,2) DEFAULT 0,
  pending_payout DECIMAL(10,2) DEFAULT 0,
  paid_out DECIMAL(10,2) DEFAULT 0,
  current_balance DECIMAL(10,2) DEFAULT 0,
  last_payout_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create payout batches table if it doesn't exist
CREATE TABLE IF NOT EXISTS payout_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number TEXT UNIQUE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  recipient_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payouts table if it doesn't exist
CREATE TABLE IF NOT EXISTS payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES payout_batches(id),
  user_id UUID REFERENCES profiles(id),
  amount DECIMAL(10,2) NOT NULL,
  stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create platform revenue table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  amount DECIMAL(10,2) NOT NULL,
  revenue_type TEXT NOT NULL, -- 'commission', 'fee', 'subscription'
  month_year TEXT NOT NULL, -- 'YYYY-MM' for monthly aggregation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_distributions_recipient ON payment_distributions(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_user_earnings_user_role ON user_earnings(user_id, role);
CREATE INDEX IF NOT EXISTS idx_platform_revenue_month ON platform_revenue(month_year);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Functions and triggers (safe to recreate)
CREATE OR REPLACE FUNCTION update_user_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Update seller earnings
  INSERT INTO user_earnings (user_id, role, total_earned, pending_payout, current_balance)
  SELECT 
    NEW.recipient_id,
    'seller',
    NEW.amount,
    CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END
  WHERE NEW.recipient_type = 'seller' AND NEW.recipient_id IS NOT NULL
  ON CONFLICT (user_id, role) DO UPDATE SET
    total_earned = user_earnings.total_earned + NEW.amount,
    pending_payout = user_earnings.pending_payout + CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    current_balance = user_earnings.current_balance + CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    updated_at = NOW();

  -- Update affiliate earnings
  INSERT INTO user_earnings (user_id, role, total_earned, pending_payout, current_balance)
  SELECT 
    NEW.recipient_id,
    'affiliate',
    NEW.amount,
    CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END
  WHERE NEW.recipient_type = 'affiliate' AND NEW.recipient_id IS NOT NULL
  ON CONFLICT (user_id, role) DO UPDATE SET
    total_earned = user_earnings.total_earned + NEW.amount,
    pending_payout = user_earnings.pending_payout + CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    current_balance = user_earnings.current_balance + CASE WHEN NEW.status = 'pending' THEN NEW.amount ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_user_earnings ON payment_distributions;
CREATE TRIGGER trigger_update_user_earnings
  AFTER INSERT OR UPDATE ON payment_distributions
  FOR EACH ROW EXECUTE FUNCTION update_user_earnings();
