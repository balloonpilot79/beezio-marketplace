-- STEP 2: ADD AFFILIATE TRACKING TO ORDERS TABLE
-- Run this AFTER AFFILIATE-TRACKING-SIMPLE.sql succeeds
-- Copy ALL of this and run in Supabase SQL Editor

-- Add affiliate tracking columns to orders table
DO $$ 
BEGIN
  -- Add affiliate_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'affiliate_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN affiliate_id UUID REFERENCES profiles(id);
  END IF;

  -- Add affiliate_commission column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'affiliate_commission'
  ) THEN
    ALTER TABLE orders ADD COLUMN affiliate_commission DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Add platform_fee column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'platform_fee'
  ) THEN
    ALTER TABLE orders ADD COLUMN platform_fee DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Add seller_payout column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'seller_payout'
  ) THEN
    ALTER TABLE orders ADD COLUMN seller_payout DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Add referral_code column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE orders ADD COLUMN referral_code VARCHAR(50);
  END IF;
END $$;

-- Create index on affiliate_id
CREATE INDEX IF NOT EXISTS idx_orders_affiliate ON orders(affiliate_id);

-- Create function to record earnings when order is placed
CREATE OR REPLACE FUNCTION record_affiliate_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only record if there's an affiliate
  IF NEW.affiliate_id IS NOT NULL AND NEW.affiliate_commission > 0 THEN
    INSERT INTO affiliate_earnings (affiliate_id, order_id, amount, status)
    VALUES (NEW.affiliate_id, NEW.id, NEW.affiliate_commission, 'pending');
    
    -- Update affiliate link stats if referral_code exists
    IF NEW.referral_code IS NOT NULL THEN
      UPDATE affiliate_links
      SET 
        conversions = conversions + 1,
        total_commission = total_commission + NEW.affiliate_commission
      WHERE referral_code = NEW.referral_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-record earnings
DROP TRIGGER IF EXISTS auto_record_affiliate_earnings ON orders;
CREATE TRIGGER auto_record_affiliate_earnings
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_affiliate_earnings();

-- SUCCESS!
-- Orders table now tracks affiliate referrals and commissions!
