# CJ Dropshipping - Complete Workflow Guide

## 🎯 Overview: How It All Works

```
┌─────────────┐
│   ADMIN     │ Imports products from CJ Dropshipping API
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────┐
│  PRODUCTS TABLE (with is_promotable=true)  │
└──────┬──────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│ MARKETPLACE │ All users browse promotable products
└──────┬──────┘
       │
       ├────────────┬────────────┐
       ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌────────────┐
│AFFILIATE │  │  SELLER  │  │ FUNDRAISER │
└────┬─────┘  └────┬─────┘  └─────┬──────┘
     │             │              │
     └─────────────┴──────────────┘
                   │
                   ▼
     ┌─────────────────────────────┐
     │   STOREFRONT_PRODUCTS       │ Each user's custom store
     └─────────────┬───────────────┘
                   │
                   ▼
     ┌─────────────────────────────┐
     │     AFFILIATE_LINKS         │ Custom links & QR codes
     └─────────────────────────────┘
```

---

## 📋 Step-by-Step Setup

### **STEP 1: Fix Database Schema** ✅

Run `FIX-PRODUCTS-TABLE-FOR-CJ.sql` in Supabase SQL Editor

**What it does:**
- ✅ Adds missing columns to `products` table (`is_promotable`, `dropship_provider`, `sku`, etc.)
- ✅ Creates `cj_product_mappings` table (links Beezio products to CJ API)
- ✅ Creates `storefront_products` table (what each affiliate/fundraiser sells)
- ✅ Creates `affiliate_links` table (custom tracking links & QR codes)
- ✅ Sets up Row Level Security (RLS) policies

---

### **STEP 2: Test with Mock Product** ✅

Run `TEST-CJ-PRODUCT-INSERT.sql` in Supabase SQL Editor

**What it does:**
- Creates a test product: "Test CJ Wireless Earbuds Pro"
- Sets `is_promotable = true` so it appears in marketplace
- Sets `dropship_provider = 'cj'` to identify it as CJ product
- Sets `affiliate_commission_rate = 30` (30% commission)

**Expected output:**
```
SUCCESS! Test product created with ID: abc-123-def
Seller ID: xyz-456
Product: Test CJ Wireless Earbuds Pro
Price: $49.99
Commission: 30%
```

---

### **STEP 3: Verify Marketplace Display** 📺

**Frontend Query (Marketplace Page):**
```typescript
const { data: products } = await supabase
  .from('products')
  .select('*')
  .eq('is_promotable', true)  // CRITICAL: Only promotable products
  .eq('is_active', true)
  .order('created_at', { ascending: false });
```

**Manual Verification (SQL):**
```sql
SELECT 
  id, 
  title, 
  price, 
  affiliate_commission_rate, 
  is_promotable,
  dropship_provider
FROM products 
WHERE is_promotable = true 
  AND is_active = true;
```

✅ Product should appear in marketplace!

---

## 🔄 Complete User Workflow

### **FOR ADMIN:**

1. Go to Admin Dashboard → CJ Import
2. Enter CJ API credentials
3. Browse CJ products
4. Set markup % and commission %
5. Click "Import Product"
6. ✅ Product created with `is_promotable = true`
7. ✅ Product appears in marketplace automatically

**Code:** `src/pages/CJProductImportPage.tsx` (line 141)

---

### **FOR AFFILIATE/FUNDRAISER/SELLER:**

#### **Step 1: Browse Marketplace**

```typescript
// Frontend query
const { data: marketplaceProducts } = await supabase
  .from('products')
  .select(`
    id,
    title,
    description,
    price,
    affiliate_commission_rate,
    image_url,
    images,
    dropship_provider,
    seller_id
  `)
  .eq('is_promotable', true)
  .eq('is_active', true);
```

#### **Step 2: Add Product to Their Store**

```typescript
// When user clicks "Add to My Store"
const { data, error } = await supabase
  .from('storefront_products')
  .insert({
    profile_id: currentUser.id,
    product_id: selectedProduct.id,
    display_order: 0,
    is_featured: false
  });
```

**SQL Verification:**
```sql
-- Check what products are in an affiliate's store
SELECT 
  sp.id,
  p.title,
  p.price,
  p.affiliate_commission_rate,
  sp.added_at
FROM storefront_products sp
JOIN products p ON sp.product_id = p.id
WHERE sp.profile_id = 'USER_ID_HERE';
```

#### **Step 3: Generate Custom Link**

```typescript
// When user clicks "Share" or "Get Link"
const linkCode = `${username}-${productSlug}`.toUpperCase();

const { data: affiliateLink, error } = await supabase
  .from('affiliate_links')
  .insert({
    profile_id: currentUser.id,
    product_id: product.id,
    link_code: linkCode,
    full_url: `https://beezio.co/p/${product.slug}?ref=${linkCode}`,
    click_count: 0,
    conversion_count: 0,
    total_earnings: 0
  })
  .select()
  .single();
```

**Example Link:**
```
https://beezio.co/p/wireless-earbuds-pro?ref=JASON-EARBUDS
```

#### **Step 4: Generate QR Code**

```typescript
import QRCode from 'qrcode';

const qrCodeDataURL = await QRCode.toDataURL(affiliateLink.full_url);

// Update affiliate_links table
await supabase
  .from('affiliate_links')
  .update({ qr_code_url: qrCodeDataURL })
  .eq('id', affiliateLink.id);
```

#### **Step 5: Track Clicks**

```typescript
// When someone clicks the affiliate link
const { data: link } = await supabase
  .from('affiliate_links')
  .select('*')
  .eq('link_code', refCode)
  .single();

// Increment click count
await supabase
  .from('affiliate_links')
  .update({ 
    click_count: link.click_count + 1,
    last_clicked_at: new Date().toISOString()
  })
  .eq('id', link.id);

// Store ref in session for commission tracking
sessionStorage.setItem('affiliate_ref', refCode);
```

---

## 🗄️ Database Schema

### **products** (Enhanced)
```sql
- id (uuid)
- seller_id (uuid)
- title (text)
- description (text)
- price (numeric)
- affiliate_commission_rate (int) ← Commission %
- is_promotable (boolean) ← Shows in marketplace
- is_active (boolean)
- dropship_provider (text) ← 'cj' for CJ products
- image_url (text)
- images (text[])
- sku (text)
- is_digital (boolean)
- requires_shipping (boolean)
- shipping_cost (numeric)
- product_type (text)
- stock_quantity (int)
```

### **cj_product_mappings** (NEW)
```sql
- id (uuid)
- beezio_product_id (uuid) → products.id
- cj_product_id (text) ← CJ API ID
- cj_product_sku (text)
- cj_cost (numeric) ← What CJ charges
- markup_percent (int) ← Your markup %
- affiliate_commission_percent (int)
- price_breakdown (jsonb) ← Full pricing details
- last_synced (timestamptz)
```

### **storefront_products** (NEW)
```sql
- id (uuid)
- profile_id (uuid) → profiles.id
- product_id (uuid) → products.id
- display_order (int)
- is_featured (boolean)
- custom_price (numeric) ← Optional override
- custom_description (text) ← Optional pitch
- added_at (timestamptz)
- UNIQUE(profile_id, product_id) ← Can't add same product twice
```

### **affiliate_links** (NEW)
```sql
- id (uuid)
- profile_id (uuid) → profiles.id
- product_id (uuid) → products.id
- link_code (text) UNIQUE ← 'JASON-EARBUDS'
- full_url (text) ← Complete tracking URL
- qr_code_url (text) ← QR code image
- click_count (int) ← Tracking
- conversion_count (int) ← Sales
- total_earnings (numeric) ← $$$
- created_at (timestamptz)
- last_clicked_at (timestamptz)
- UNIQUE(profile_id, product_id) ← One link per product per user
```

---

## 🧪 Testing Checklist

### **Phase 1: Database Setup**
- [ ] Run `FIX-PRODUCTS-TABLE-FOR-CJ.sql`
- [ ] Verify success message shows
- [ ] Run `TEST-CJ-PRODUCT-INSERT.sql`
- [ ] Verify product created with UUID

### **Phase 2: Marketplace Display**
```sql
-- Should return test product
SELECT * FROM products WHERE is_promotable = true;
```
- [ ] Query returns test product
- [ ] Test product has `is_promotable = true`
- [ ] Test product has `dropship_provider = 'cj'`
- [ ] Test product has `affiliate_commission_rate = 30`

### **Phase 3: Add to Store**
```sql
-- Manually test adding to store
INSERT INTO storefront_products (profile_id, product_id)
VALUES ('YOUR_USER_ID', 'TEST_PRODUCT_ID');
```
- [ ] Insert succeeds
- [ ] Can query your storefront products
- [ ] Can't add same product twice (UNIQUE constraint)

### **Phase 4: Generate Link**
```sql
-- Manually create affiliate link
INSERT INTO affiliate_links (
  profile_id, 
  product_id, 
  link_code, 
  full_url
) VALUES (
  'YOUR_USER_ID',
  'TEST_PRODUCT_ID',
  'JASON-EARBUDS',
  'https://beezio.co/p/test-earbuds?ref=JASON-EARBUDS'
);
```
- [ ] Insert succeeds
- [ ] Can query by `link_code`
- [ ] Can track clicks

### **Phase 5: CJ API Import (Real)**
- [ ] Wait for CJ API rate limit to reset (5+ minutes)
- [ ] Go to Admin → CJ Import
- [ ] Browse CJ products
- [ ] Set markup to 115%, commission to 30%
- [ ] Import a product
- [ ] Verify product in database with `is_promotable = true`
- [ ] Verify product appears in marketplace

---

## 🚨 Common Issues & Fixes

### **Issue: Product doesn't appear in marketplace**
**Fix:**
```sql
UPDATE products 
SET is_promotable = true, is_active = true 
WHERE dropship_provider = 'cj';
```

### **Issue: Can't add product to store**
**Check:**
1. `storefront_products` table exists
2. RLS policies are enabled
3. User is logged in (`auth.uid()` returns value)

### **Issue: CJ API rate limited**
**Solution:** Wait 5 minutes between API calls or use test product

### **Issue: Column doesn't exist error**
**Fix:** Run `FIX-PRODUCTS-TABLE-FOR-CJ.sql` again

---

## 📊 Price Breakdown Example

**CJ Product:** $19.99

**Your Settings:**
- Markup: 115%
- Affiliate Commission: 30%

**Calculation:**
```
CJ Cost:              $19.99
Your Markup (115%):   $22.99
Subtotal:             $42.98
Affiliate Commission: $12.89 (30% of subtotal)
Beezio Fee (10%):     $4.30
Stripe Fee (3%):      $1.29
──────────────────────────────
Final Customer Price: $49.99
```

**Stored in `cj_product_mappings.price_breakdown`:**
```json
{
  "cjCost": 19.99,
  "yourProfit": 22.99,
  "affiliateCommission": 12.89,
  "beezioFee": 4.30,
  "stripeFee": 1.29,
  "finalPrice": 49.99
}
```

---

## 🎯 Next Steps

1. **Run `FIX-PRODUCTS-TABLE-FOR-CJ.sql`** ← Do this first!
2. **Run `TEST-CJ-PRODUCT-INSERT.sql`** ← Test with mock product
3. **Build & Deploy:** `npm run build && netlify deploy --prod`
4. **Test marketplace display**
5. **Test adding to affiliate store**
6. **Test custom link generation**
7. **Wait for CJ API rate limit** (5+ min)
8. **Import real CJ product**
9. **Complete end-to-end purchase test**

---

## 🎉 Success Criteria

✅ Admin can import CJ products
✅ Products appear in marketplace with `is_promotable = true`
✅ Affiliates can browse marketplace
✅ Affiliates can add products to their stores
✅ Fundraisers can add products to their stores
✅ Custom tracking links generated
✅ QR codes generated
✅ Clicks tracked
✅ Commissions calculated correctly
✅ Complete purchase flow works

---

**IMPORTANT:** Run the SQL files in this order:
1. `FIX-PRODUCTS-TABLE-FOR-CJ.sql` (database schema)
2. `TEST-CJ-PRODUCT-INSERT.sql` (test product)
3. Test the complete workflow
4. Import real CJ products when API allows
