-- TEST SCRIPT: Insert a mock CJ dropshipping product to test the workflow
-- This bypasses the rate-limited CJ API to test:
-- 1. Product appears in marketplace
-- 2. Affiliates can add to their stores
-- 3. Fundraisers can add to their stores
-- 4. Custom links and QR codes work

-- Step 1: Get the first admin/seller user ID from profiles
DO $$
DECLARE
  seller_uuid UUID;
  product_uuid UUID;
BEGIN
  -- Get first user with seller or admin role
  SELECT id INTO seller_uuid
  FROM profiles
  WHERE role IN ('seller', 'admin')
  LIMIT 1;

  IF seller_uuid IS NULL THEN
    RAISE EXCEPTION 'No seller or admin user found. Please create a user first.';
  END IF;

  -- Insert the test product with ALL required columns
  INSERT INTO products (
    seller_id,
    title,
    description,
    price,
    is_active,
    stock_quantity,
    affiliate_commission_rate,
    product_type,
    is_promotable,
    dropship_provider,
    image_url,
    images,
    sku,
    is_digital,
    requires_shipping,
    shipping_cost
  ) 
  VALUES (
    seller_uuid,
    'Test CJ Wireless Earbuds Pro',
    'Premium wireless earbuds with active noise cancellation. Bluetooth 5.0, 30-hour battery life. 30% commission for affiliates and fundraisers!',
    49.99,
    true,
    999,
    30,
    'one_time',
    true, -- is_promotable: Shows in marketplace
    'cj', -- dropship_provider: From CJ Dropshipping
    'https://img.cjdropshipping.com/default-product.jpg', -- image_url
    ARRAY['https://img.cjdropshipping.com/default-product.jpg'], -- images array
    'TEST-CJ-EARBUDS-001', -- sku
    false, -- is_digital: Physical product
    true, -- requires_shipping
    0 -- shipping_cost: Free shipping
  )
  RETURNING id INTO product_uuid;

  RAISE NOTICE 'SUCCESS! Test product created with ID: %', product_uuid;
  RAISE NOTICE 'Seller ID: %', seller_uuid;
  RAISE NOTICE 'Product: Test CJ Wireless Earbuds Pro';
  RAISE NOTICE 'Price: $49.99';
  RAISE NOTICE 'Commission: 30%%';
END $$;

-- Step 2: Create the CJ product mapping (optional but good for tracking)
-- You'll need to replace <PRODUCT_ID> with the ID returned from Step 1
-- INSERT INTO cj_product_mappings (
--   beezio_product_id,
--   cj_product_id,
--   cj_product_sku,
--   cj_cost,
--   markup_percent,
--   affiliate_commission_percent,
--   price_breakdown,
--   last_synced
-- ) VALUES (
--   '<PRODUCT_ID>', -- Replace with actual product ID
--   'TEST-PID-12345',
--   'TEST-CJ-WEB-001',
--   19.99, -- Mock CJ cost
--   115, -- 115% markup
--   30, -- 30% affiliate commission
--   jsonb_build_object(
--     'cjCost', 19.99,
--     'yourProfit', 10.50,
--     'affiliateCommission', 15.00,
--     'recruiterCommission', 2.50,
--     'beezioFee', 5.00,
--     'stripeFee', 1.75,
--     'finalPrice', 49.99
--   ),
--   NOW()
-- );

-- VERIFICATION QUERIES:
-- Check the product was created
SELECT 
  id,
  title,
  price,
  affiliate_commission_rate,
  is_active,
  product_type,
  seller_id
FROM products 
WHERE title = 'Test CJ Wireless Earbuds Pro'
ORDER BY created_at DESC
LIMIT 1;

-- Check it appears in products list (available for promotion)
SELECT 
  id,
  title,
  price,
  affiliate_commission_rate,
  is_active
FROM products 
WHERE is_active = true 
ORDER BY created_at DESC;

-- TESTING CHECKLIST:
-- [ ] 1. Run this SQL in Supabase SQL Editor
-- [ ] 2. Go to Marketplace page - verify product appears
-- [ ] 3. Login as affiliate - click "Add to My Store" - verify it gets added to storefront_products
-- [ ] 4. Go to affiliate store page - verify product displays
-- [ ] 5. Click "Share" - verify custom link is generated
-- [ ] 6. Click "Generate QR Code" - verify QR code displays
-- [ ] 7. Login as fundraiser - verify can add to fundraiser store
-- [ ] 8. Test purchase flow (optional - don't actually charge)
