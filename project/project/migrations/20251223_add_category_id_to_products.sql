-- Migration: Ensure products table has category_id column as a foreign key to categories
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id);

-- (Optional) If you want to keep the legacy category (TEXT) column, do nothing. If you want to remove it:
-- ALTER TABLE products DROP COLUMN IF EXISTS category;

-- (Optional) Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);