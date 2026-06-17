-- Add affiliate_enabled column to products table
-- This column controls whether products appear in marketplace for affiliates
-- or only in seller's custom store

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS affiliate_enabled BOOLEAN DEFAULT true;

-- Update existing products to default to affiliate-enabled
-- (This maintains current behavior for existing products)
UPDATE products 
SET affiliate_enabled = true 
WHERE affiliate_enabled IS NULL;

-- Add comment to explain the column
COMMENT ON COLUMN products.affiliate_enabled IS 'Controls product visibility: true = marketplace + seller store, false = seller store only';

-- Optional: Update product status based on affiliate preference
-- Products with affiliate_enabled = false should have status = 'store_only'
-- Products with affiliate_enabled = true should have status = 'active' (for marketplace)

UPDATE products 
SET status = CASE 
    WHEN affiliate_enabled = true THEN 'active'
    WHEN affiliate_enabled = false THEN 'store_only'
    ELSE status
END;