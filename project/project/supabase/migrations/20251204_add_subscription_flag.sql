-- Ensure subscription-related columns exist on products for UI forms
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_interval TEXT,
  ADD COLUMN IF NOT EXISTS subscription_price NUMERIC,
  ADD COLUMN IF NOT EXISTS trial_period_days INTEGER,
  ADD COLUMN IF NOT EXISTS setup_fee NUMERIC;
