-- Add order-level shipping metadata for CJ fulfillment
-- Safe to run repeatedly

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_info jsonb,
  ADD COLUMN IF NOT EXISTS shipping_logistic_name text;
