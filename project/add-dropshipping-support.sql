-- =====================================================
-- ADD DROPSHIPPING & BULK UPLOAD SUPPORT
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add supplier_info column to products table (JSONB for flexibility)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS supplier_info JSONB;

-- Add index for dropshipped products
CREATE INDEX IF NOT EXISTS idx_products_dropshipped 
ON products ((supplier_info->>'is_dropshipped')) 
WHERE (supplier_info->>'is_dropshipped')::boolean = true;

-- Add SKU column if not exists
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE;

-- Add tracking to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;

-- Create index for tracking number lookups
CREATE INDEX IF NOT EXISTS idx_orders_tracking 
ON orders(tracking_number) 
WHERE tracking_number IS NOT NULL;

-- =====================================================
-- EXAMPLE SUPPLIER_INFO STRUCTURE
-- =====================================================

-- supplier_info JSONB structure:
-- {
--   "supplier_name": "Supplier Inc",
--   "supplier_product_id": "SUP-12345",
--   "supplier_url": "https://supplier.com/product/12345",
--   "is_dropshipped": true,
--   "supplier_notes": "Order processing time: 2-3 business days"
-- }

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check products table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
AND column_name IN ('supplier_info', 'sku')
ORDER BY ordinal_position;

-- Check orders table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('tracking_number', 'shipped_at')
ORDER BY ordinal_position;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '✅ DROPSHIPPING & BULK UPLOAD READY!';
  RAISE NOTICE '✅ ================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📦 NEW FEATURES:';
  RAISE NOTICE '   • supplier_info column added to products';
  RAISE NOTICE '   • SKU column added for inventory tracking';
  RAISE NOTICE '   • tracking_number & shipped_at added to orders';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 YOU CAN NOW:';
  RAISE NOTICE '   1. Bulk upload products via Excel/Google Sheets';
  RAISE NOTICE '   2. Mark products as dropshipped';
  RAISE NOTICE '   3. Store supplier information';
  RAISE NOTICE '   4. Fulfill orders with tracking numbers';
  RAISE NOTICE '   5. Ship directly from suppliers to customers';
  RAISE NOTICE '';
  RAISE NOTICE '📝 NEXT STEPS:';
  RAISE NOTICE '   • Go to /seller/bulk-upload';
  RAISE NOTICE '   • Download template Excel file';
  RAISE NOTICE '   • Fill in your products';
  RAISE NOTICE '   • Upload and start selling!';
  RAISE NOTICE '';
END $$;
