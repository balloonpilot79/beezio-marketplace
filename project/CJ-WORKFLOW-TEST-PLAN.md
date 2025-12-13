# CJ Dropshipping Integration - Complete Workflow Test Plan
**Date:** December 10, 2025
**Goal:** Test the complete affiliate/fundraiser workflow WITHOUT touching the CJ API (rate limited)

## Phase 1: Insert Test Product

Run this SQL in Supabase SQL Editor to create a mock CJ product:

```sql
INSERT INTO products (
  seller_id,
  name,
  description,
  price,
  category,
  image_url,
  images,
  sku,
  stock_quantity,
  is_digital,
  requires_shipping,
  shipping_cost,
  commission_rate,
  product_type,
  dropship_provider,
  is_promotable,
  is_active,
  created_at,
  updated_at
) VALUES (
  '4d59ff22-dc79-48f3-ab48-9b97aebd597d', -- jason@beezio.co
  'Test CJ Product - Wireless Earbuds Pro',
  'Premium wireless earbuds with active noise cancellation, 30-hour battery life, and crystal-clear sound quality. Perfect for music lovers and professionals. This is a TEST product to verify the complete workflow.',
  49.99,
  'Electronics',
  'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800',
  ARRAY[
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800',
    'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=800',
    'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=800'
  ],
  'TEST-CJ-EARBUDS-001',
  9999,
  false,
  true,
  0,
  30, -- 30% affiliate commission
  'dropship',
  'cj',
  true, -- Available in marketplace
  true, -- Active
  NOW(),
  NOW()
)
RETURNING id, name, price, commission_rate;
```

## Phase 2: Verify Product in Marketplace

### Test 1: Marketplace Display
**Steps:**
1. Go to https://beezio.co/marketplace
2. Look for "Test CJ Product - Wireless Earbuds Pro"
3. Verify it displays with:
   - Product image
   - Name
   - Price: $49.99
   - Commission rate: 30%
   - "Add to Store" or promotion button

**Expected Behavior:**
- Product appears in marketplace grid/list
- Commission badge shows "30% commission"
- Product is clickable to view details

**SQL Verification:**
```sql
-- Should return the test product
SELECT id, name, price, commission_rate, is_promotable, is_active
FROM products 
WHERE sku = 'TEST-CJ-EARBUDS-001';
```

---

## Phase 3: Affiliate Workflow

### Test 2: Add to Affiliate Store
**Steps:**
1. Login as an affiliate user (NOT jason@beezio.co)
2. Go to Marketplace or Dashboard → "Products to Promote"
3. Find the Test CJ Product
4. Click "Add to My Store" or "Promote"

**Expected Behavior:**
- Success message: "Product added to your store"
- Product should now appear in affiliate's personal store
- Entry created in `storefront_products` table

**SQL Verification:**
```sql
-- Check if added to affiliate store
SELECT 
  sp.id,
  sp.storefront_id,
  sp.product_id,
  sp.is_active,
  sf.owner_id,
  p.name as product_name
FROM storefront_products sp
JOIN storefronts sf ON sp.storefront_id = sf.id
JOIN products p ON sp.product_id = p.id
WHERE p.sku = 'TEST-CJ-EARBUDS-001';
```

### Test 3: View in Affiliate Store
**Steps:**
1. While logged in as affiliate
2. Go to "My Store" or your storefront URL
3. Find the Test CJ Product

**Expected Behavior:**
- Product displays in affiliate's store
- Shows correct price ($49.99)
- Shows commission amount (30% of markup = ~$15)
- "Share" and "QR Code" buttons visible

### Test 4: Generate Custom Affiliate Link
**Steps:**
1. On the product in your store
2. Click "Share" or "Get Link"
3. Copy the generated affiliate link

**Expected Behavior:**
- Link format: `https://beezio.co/products/[product-id]?ref=[affiliate-code]`
- Or: `https://beezio.co/stores/[store-slug]/products/[product-id]`
- Link is unique to this affiliate

**SQL Verification:**
```sql
-- Check affiliate link generation
SELECT 
  link_code,
  affiliate_id,
  product_id,
  clicks,
  created_at
FROM affiliate_links
WHERE product_id = (SELECT id FROM products WHERE sku = 'TEST-CJ-EARBUDS-001');
```

### Test 5: Generate QR Code
**Steps:**
1. Click "Generate QR Code" or QR icon
2. Verify QR code displays
3. (Optional) Scan with phone to test

**Expected Behavior:**
- QR code image appears
- Code encodes the affiliate link
- Scanning opens product page with affiliate ref

---

## Phase 4: Fundraiser Workflow

### Test 6: Add to Fundraiser Store
**Steps:**
1. Login as a fundraiser user
2. Go to Dashboard → "Add Products"
3. Browse marketplace
4. Find Test CJ Product
5. Click "Add to Fundraiser Store"

**Expected Behavior:**
- Product added to fundraiser's store
- Shows fundraiser commission rate
- Entry in `storefront_products` with fundraiser's storefront

**SQL Verification:**
```sql
-- Check fundraiser additions
SELECT 
  sf.id as storefront_id,
  sf.name as store_name,
  sf.owner_id,
  p.name as product_name,
  p.commission_rate
FROM storefronts sf
JOIN storefront_products sp ON sf.id = sp.storefront_id
JOIN products p ON sp.product_id = p.id
WHERE p.sku = 'TEST-CJ-EARBUDS-001'
  AND sf.type = 'fundraiser';
```

### Test 7: Fundraiser Custom Links
**Steps:**
1. In fundraiser dashboard
2. View the added product
3. Generate custom link and QR code

**Expected Behavior:**
- Link includes fundraiser reference
- Commission tracking tied to fundraiser
- QR code works same as affiliate

---

## Phase 5: Link Tracking & Analytics

### Test 8: Click Tracking
**Steps:**
1. Copy affiliate/fundraiser link
2. Open in incognito/private browser
3. Click the link
4. View product page

**Expected Behavior:**
- Product page loads
- Affiliate ref stored in session/cookie
- Click count increments

**SQL Verification:**
```sql
-- Check click tracking
SELECT 
  link_code,
  clicks,
  last_clicked_at
FROM affiliate_links
WHERE product_id = (SELECT id FROM products WHERE sku = 'TEST-CJ-EARBUDS-001')
ORDER BY clicks DESC;
```

### Test 9: View Tracking in Dashboard
**Steps:**
1. Login as affiliate/fundraiser
2. Go to dashboard analytics
3. Check product performance

**Expected Behavior:**
- Shows click count
- Shows views
- Shows conversion rate (if purchases made)

---

## Phase 6: Product Display Features

### Test 10: Product Details Page
**Steps:**
1. Click on product from marketplace
2. View full product details

**Expected Behavior:**
- All product info displays
- Multiple images show
- Price breakdown visible
- "Add to Cart" or purchase button

### Test 11: Search & Filter
**Steps:**
1. Go to marketplace
2. Search for "earbuds"
3. Filter by Electronics category
4. Filter by 30% commission

**Expected Behavior:**
- Test product appears in search results
- Filters correctly apply
- Sorting works (by price, commission, etc.)

---

## Phase 7: Purchase Flow (Optional - DON'T ACTUALLY PAY)

### Test 12: Add to Cart
**Steps:**
1. Use affiliate link to view product
2. Click "Add to Cart"
3. Go to cart

**Expected Behavior:**
- Product in cart
- Price shows $49.99
- Affiliate ref persists

### Test 13: Checkout (STOP BEFORE PAYMENT)
**Steps:**
1. Start checkout process
2. Enter shipping info
3. STOP before entering payment

**Expected Behavior:**
- Order creation process works
- Affiliate ref attached to order
- Commission calculation correct

**SQL Check:**
```sql
-- Check if order has affiliate ref
SELECT 
  id,
  order_number,
  affiliate_id,
  total_amount,
  commission_amount
FROM orders
WHERE affiliate_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

---

## Test Checklist Summary

### Marketplace Integration
- [ ] Product appears in marketplace with correct data
- [ ] Product has "promotable" badge
- [ ] Commission rate displays correctly
- [ ] Images load properly

### Affiliate Features
- [ ] Affiliates can add product to their store
- [ ] Product appears in affiliate store
- [ ] Custom affiliate link generated
- [ ] QR code generated and works
- [ ] Click tracking works
- [ ] Analytics show in dashboard

### Fundraiser Features
- [ ] Fundraisers can add product to store
- [ ] Product appears in fundraiser store
- [ ] Custom fundraiser link generated
- [ ] QR code works for fundraisers
- [ ] Commission tracking separate from affiliates

### General Features
- [ ] Search finds the product
- [ ] Filters work correctly
- [ ] Product detail page loads
- [ ] Multiple images display
- [ ] Add to cart works
- [ ] Affiliate ref persists through checkout

---

## Cleanup After Testing

```sql
-- Remove test product
DELETE FROM storefront_products 
WHERE product_id = (SELECT id FROM products WHERE sku = 'TEST-CJ-EARBUDS-001');

DELETE FROM affiliate_links
WHERE product_id = (SELECT id FROM products WHERE sku = 'TEST-CJ-EARBUDS-001');

DELETE FROM products 
WHERE sku = 'TEST-CJ-EARBUDS-001';
```

---

## Next Steps After Testing

1. **If all tests pass:** The CJ import feature is ready - just need working API access
2. **If tests fail:** Document which specific feature isn't working
3. **When CJ API works:** The imported products will automatically have same workflow

## Notes
- This test uses a mock product that simulates a CJ import
- All functionality should work identically to real CJ products
- The `dropship_provider: 'cj'` field identifies it as a dropship product
- The `is_promotable: true` flag makes it available for affiliates/fundraisers
