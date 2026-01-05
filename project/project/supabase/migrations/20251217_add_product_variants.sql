-- Add variants column to products table to support Size/Color options
-- Run this in your Supabase SQL Editor

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- Add index for faster searching within variants if needed
CREATE INDEX IF NOT EXISTS idx_products_variants ON products USING gin (variants);
