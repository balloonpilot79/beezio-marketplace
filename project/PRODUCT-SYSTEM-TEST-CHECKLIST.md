# 🧪 PRODUCT SYSTEM TEST CHECKLIST

**Before loading hundreds of products, test these 10 items:**

---

## ✅ PRE-TEST SETUP (5 minutes)

### 1. **Run Storage Bucket SQL**
```bash
File: setup-product-images-bucket.sql
Location: Supabase SQL Editor
Expected: ✅ "Storage buckets created successfully!"
```

### 2. **Verify Bucket in Dashboard**
```bash
Supabase Dashboard → Storage → Buckets
✅ product-images (public)
✅ user-avatars (public)
✅ store-branding (public)
```

### 3. **Test Image Upload in Supabase**
```bash
Storage → product-images → Upload File
✅ Upload any test image (JPG/PNG)
✅ Click the file → Copy public URL
✅ Paste URL in browser → Image loads ✅
```

---

## 🧪 TEST SCENARIOS (30 minutes)

### **TEST 1: Create Single Product (Manual)**
**Goal**: Verify basic product creation works

1. **Navigate**: `/dashboard/products/add`
2. **Fill form**:
   - Title: "Test Product 1"
   - Description: "This is a test product"
   - Price: 50.00
   - Category: Electronics
   - Stock: 10
   - Commission: 20%
3. **Upload image**:
   - Drag-drop 1 photo
   - Wait for green checkmark ✅
4. **Add shipping**:
   - Standard: $5.99 (3-5 days)
5. **Click**: "Create Product"

**Expected Result**:
- ✅ Success message appears
- ✅ Redirect to product detail page
- ✅ Image displays correctly
- ✅ Price shows as $50.00
- ✅ Shipping options visible
- ✅ Commission badge shows "20%"

**If Failed**:
- ❌ Check browser console for errors
- ❌ Check Supabase logs for failed query
- ❌ Verify storage bucket exists

---

### **TEST 2: Upload Multiple Images**
**Goal**: Verify multi-image upload works

1. **Navigate**: `/dashboard/products/add`
2. **Fill basic info**:
   - Title: "Test Multi-Image Product"
   - Price: 75.00
3. **Upload 5 images**:
   - Drag all 5 at once
   - Watch progress bars
   - Wait for all green checkmarks ✅
4. **Save product**

**Expected Result**:
- ✅ All 5 images show in gallery
- ✅ First image is primary (auto-selected)
- ✅ Can click images to view full-size
- ✅ Product page shows image carousel

**If Failed**:
- ❌ Check file sizes (must be < 10 MB each)
- ❌ Check file types (JPG/PNG/WebP only)
- ❌ Check storage bucket policies

---

### **TEST 3: Edit Existing Product**
**Goal**: Verify product editing works

1. **Navigate**: `/dashboard/products`
2. **Click**: "Edit" on Test Product 1
3. **Change**:
   - Title: "Test Product 1 - UPDATED"
   - Price: 60.00
   - Add 2 more images
4. **Save changes**

**Expected Result**:
- ✅ Changes saved successfully
- ✅ Title updated on marketplace
- ✅ Price updated to $60.00
- ✅ New images added to gallery
- ✅ Old images still present

**If Failed**:
- ❌ Check RLS policies on products table
- ❌ Verify user is product owner

---

### **TEST 4: Delete Product Image**
**Goal**: Verify image deletion works

1. **Navigate**: Edit mode for any product
2. **Click**: "Delete" icon on one image
3. **Confirm**: Deletion
4. **Save product**

**Expected Result**:
- ✅ Image removed from gallery
- ✅ Image removed from storage bucket
- ✅ Other images remain intact
- ✅ If primary deleted, next image becomes primary

**If Failed**:
- ❌ Check storage.objects DELETE policy
- ❌ Verify user owns the image folder

---

### **TEST 5: Product Appears on Marketplace**
**Goal**: Verify product displays publicly

1. **Navigate**: `/marketplace`
2. **Search**: "Test Product"
3. **Verify card shows**:
   - ✅ Product image (not broken)
   - ✅ Product title
   - ✅ Price ($50.00 or $60.00)
   - ✅ Commission badge (20%)
   - ✅ "Buy Now" button
4. **Click**: Product card
5. **Verify detail page**:
   - ✅ All images load
   - ✅ Description displays
   - ✅ Shipping options visible
   - ✅ Pricing calculator works

**If Failed**:
- ❌ Check is_active = true
- ❌ Check RLS SELECT policy
- ❌ Verify images are public URLs

---

### **TEST 6: Submit Product Review**
**Goal**: Verify review system works

1. **Login**: As different user (not seller)
2. **Navigate**: Product detail page
3. **Scroll**: To reviews section
4. **Click**: "Write a Review"
5. **Fill**:
   - Rating: 5 stars
   - Title: "Great product!"
   - Content: "This is a test review."
6. **Submit**

**Expected Result**:
- ✅ Review appears immediately
- ✅ Average rating updates (5.0)
- ✅ Review count shows (1)
- ✅ Product card shows 5 stars
- ✅ Can vote "helpful" on review

**If Failed**:
- ❌ Run migration: 20250722000000_add_reviews_and_ratings.sql
- ❌ Check RLS policies on product_reviews
- ❌ Verify user is authenticated

---

### **TEST 7: Pricing Calculator**
**Goal**: Verify pricing breakdown is accurate

1. **Create product**: Price $100.00
2. **Check calculator shows**:
   - Seller Price: $100.00 ✅
   - Platform Fee (15%): $15.00
   - Referral Bonus (5%): $5.00 (if applicable)
   - Stripe Fee: ~$3.48
   - **Buyer Total**: ~$123.48
3. **Verify**: Seller actually receives $100.00 after sale

**Expected Result**:
- ✅ Calculator shows all fees
- ✅ Total matches checkout
- ✅ Seller gets exact asking price

**If Failed**:
- ❌ Check PricingCalculator component
- ❌ Verify platform_settings table
- ❌ Check fee calculation logic

---

### **TEST 8: Shipping Options**
**Goal**: Verify custom shipping works

1. **Create product** with:
   - Standard: $5.99 (3-5 days)
   - Express: $14.99 (1-2 days)
   - Custom: $9.99 (Priority Mail)
2. **Go to checkout**
3. **Verify**:
   - All 3 options display
   - Can select any option
   - Price updates correctly
   - Order summary shows shipping cost

**Expected Result**:
- ✅ Buyer sees all shipping options
- ✅ Can switch between options
- ✅ Total recalculates instantly
- ✅ Selected option saves to order

**If Failed**:
- ❌ Check shipping_options JSONB format
- ❌ Verify ShippingSelector component
- ❌ Check requires_shipping = true

---

### **TEST 9: Stock Tracking**
**Goal**: Verify inventory management works

1. **Create product**: Stock = 5
2. **Place order**: Buy 2 units
3. **Check stock**: Should show 3 remaining
4. **Try to buy 10**: Should show "Insufficient stock"
5. **Check seller dashboard**: Shows low stock warning

**Expected Result**:
- ✅ Stock decrements after purchase
- ✅ Can't oversell (quantity limit enforced)
- ✅ Low stock badge when < 5
- ✅ Out of stock hides "Buy Now" button

**If Failed**:
- ❌ Check stock_quantity column
- ❌ Verify order creation triggers
- ❌ Check inventory update logic

---

### **TEST 10: Affiliate Link Generation**
**Goal**: Verify affiliate system works

1. **Login**: As affiliate user
2. **Navigate**: `/affiliate/products`
3. **Find**: Test Product 1
4. **Click**: "Add to Promote"
5. **Copy**: Affiliate link
6. **Open in incognito**: Paste link
7. **Purchase**: Product via affiliate link
8. **Check**: Affiliate dashboard shows commission

**Expected Result**:
- ✅ Affiliate link generated with code
- ✅ Link redirects to product page
- ✅ Referral tracked in browser session
- ✅ Commission credited to affiliate
- ✅ Seller gets full asking price

**If Failed**:
- ❌ Check referrals table exists
- ❌ Verify referral_code in profiles
- ❌ Check affiliate_links table
- ❌ Verify commission calculation

---

## 📊 TEST RESULTS SUMMARY

### **Passing Criteria (Must Pass 9/10)**
```
TEST 1: Create Single Product       [ ]
TEST 2: Upload Multiple Images      [ ]
TEST 3: Edit Existing Product       [ ]
TEST 4: Delete Product Image        [ ]
TEST 5: Product on Marketplace      [ ]
TEST 6: Submit Product Review       [ ]
TEST 7: Pricing Calculator          [ ]
TEST 8: Shipping Options            [ ]
TEST 9: Stock Tracking              [ ]
TEST 10: Affiliate Link Generation  [ ]

Score: ___/10
```

### **If 9/10 Pass**: ✅ Ready for production uploads
### **If 7-8/10 Pass**: ⚠️ Fix critical issues first
### **If <7/10 Pass**: ❌ Major problems, do not bulk upload

---

## 🚨 COMMON ISSUES & QUICK FIXES

### **"Bucket not found" error**
```sql
-- Run this in Supabase SQL Editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;
```

### **"Unauthorized" on image upload**
```sql
-- Run this in Supabase SQL Editor
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
);
```

### **Product not visible on marketplace**
```sql
-- Check if product is active
SELECT id, title, is_active, seller_id
FROM products
WHERE seller_id = 'YOUR_USER_ID';

-- If is_active = false, update it:
UPDATE products
SET is_active = true
WHERE id = 'PRODUCT_ID';
```

### **Reviews not showing**
```bash
# Run the migration file
File: supabase/migrations/20250722000000_add_reviews_and_ratings.sql
Location: Supabase SQL Editor
Action: Copy/paste entire file and run
```

### **Pricing calculator broken**
```sql
-- Check platform settings exist
SELECT * FROM platform_settings;

-- If empty, insert defaults:
INSERT INTO platform_settings (key, value, description)
VALUES 
  ('platform_fee_percentage', '15', 'Platform fee percentage'),
  ('stripe_fee_percentage', '2.9', 'Stripe fee percentage'),
  ('stripe_fee_flat', '0.60', 'Stripe flat fee in dollars')
ON CONFLICT (key) DO NOTHING;
```

---

## ✅ READY TO GO?

**After completing all tests above:**

1. ✅ **9+ tests passed** → Safe to bulk upload
2. ✅ **Storage bucket verified** → Images will upload correctly
3. ✅ **Reviews working** → Customers can leave feedback
4. ✅ **Pricing accurate** → No financial issues
5. ✅ **Marketplace displays** → Products are visible
6. ✅ **Affiliates can promote** → Commission tracking works

**You are now ready to:**
- Load 100s of products via CSV import
- Connect Shopify/Etsy for bulk import
- Add products manually with confidence
- Accept customer reviews and ratings
- Track inventory across all products

---

## 📝 TEST LOG TEMPLATE

**Date**: _________________  
**Tester**: _________________  
**Environment**: Production / Staging

| Test # | Test Name | Pass/Fail | Notes |
|--------|-----------|-----------|-------|
| 1 | Create Single Product | ⬜ | |
| 2 | Upload Multiple Images | ⬜ | |
| 3 | Edit Existing Product | ⬜ | |
| 4 | Delete Product Image | ⬜ | |
| 5 | Product on Marketplace | ⬜ | |
| 6 | Submit Product Review | ⬜ | |
| 7 | Pricing Calculator | ⬜ | |
| 8 | Shipping Options | ⬜ | |
| 9 | Stock Tracking | ⬜ | |
| 10 | Affiliate Link Generation | ⬜ | |

**Overall Score**: ___/10

**Critical Issues Found**:
- 
- 

**Ready for Production?**: YES / NO

**Signed**: _________________
