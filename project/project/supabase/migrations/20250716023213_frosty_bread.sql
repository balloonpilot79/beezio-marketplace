/*
  # Update products table for new pricing model

  1. New Columns
    - `seller_amount` (numeric) - What seller actually receives
    - `platform_fee` (numeric) - Beezio's 10% platform fee
    - `stripe_fee` (numeric) - Stripe's 3% processing fee
    - Update existing price column to represent final customer price

  2. Security
    - Maintain existing RLS policies
    - Add indexes for performance

  3. Notes
    - `price` column now represents what customer pays (listing price)
    - `seller_amount` is what seller receives (their desired profit)
    - All fees are calculated and stored for transparency
*/

-- Add new pricing columns to products table
DO $$
BEGIN
  -- Add seller_amount column (what seller actually gets)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'seller_amount'
  ) THEN
    ALTER TABLE products ADD COLUMN seller_amount numeric(10,2) DEFAULT 0;
  END IF;

  -- Add platform_fee column (Beezio's 10% fee)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'platform_fee'
  ) THEN
    ALTER TABLE products ADD COLUMN platform_fee numeric(10,2) DEFAULT 0;
  END IF;

  -- Add stripe_fee column (Stripe's 3% processing fee)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'stripe_fee'
  ) THEN
    ALTER TABLE products ADD COLUMN stripe_fee numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_seller_amount ON products(seller_amount);
CREATE INDEX IF NOT EXISTS idx_products_platform_fee ON products(platform_fee);

-- Add comments to clarify the pricing model
COMMENT ON COLUMN products.price IS 'Final price customer pays (listing price)';
COMMENT ON COLUMN products.seller_amount IS 'Amount seller receives (their desired profit)';
COMMENT ON COLUMN products.platform_fee IS 'Beezio platform fee (10% of seller + affiliate)';
COMMENT ON COLUMN products.stripe_fee IS 'Stripe processing fee (3% of total)';
COMMENT ON COLUMN products.commission_rate IS 'Affiliate commission rate (percentage or flat rate)';
COMMENT ON COLUMN products.flat_commission_amount IS 'Flat commission amount (when commission_type is flat_rate)';

-- Update existing products to have proper pricing structure (if any exist)
-- This is a one-time migration for existing data
UPDATE products 
SET 
  seller_amount = CASE 
    WHEN seller_amount = 0 THEN price * 0.77  -- Approximate seller amount from old pricing
    ELSE seller_amount 
  END,
  platform_fee = CASE 
    WHEN platform_fee = 0 THEN price * 0.10  -- 10% platform fee
    ELSE platform_fee 
  END,
  stripe_fee = CASE 
    WHEN stripe_fee = 0 THEN price * 0.03  -- 3% Stripe fee
    ELSE stripe_fee 
  END
WHERE seller_amount = 0 OR platform_fee = 0 OR stripe_fee = 0;