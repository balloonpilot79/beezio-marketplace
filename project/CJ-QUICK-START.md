# 🚀 CJ DROPSHIPPING - QUICK START GUIDE

## ✅ DEPLOYMENT COMPLETE!
**Live URL:** https://beezio.co

---

## 📋 DATABASE SETUP (Do This First!)

### **STEP 1: Run FIX-PRODUCTS-TABLE-FOR-CJ.sql**

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Open: `project/project/FIX-PRODUCTS-TABLE-FOR-CJ.sql`
4. Copy ALL the SQL
5. Paste into Supabase SQL Editor
6. Click "RUN"

**Expected Output:**
```
✅ COMPLETE CJ WORKFLOW SYSTEM READY!

📦 PRODUCTS TABLE ENHANCED:
   • sku - Product SKU from CJ
   • is_promotable - Shows in marketplace
   • dropship_provider - Tracks "cj"
   • image_url - Single product image
   • is_digital - Physical vs digital
   • slug - URL-friendly identifier

🗃️ NEW TABLES CREATED:
   • cj_product_mappings - CJ API integration
   • storefront_products - Affiliate/Fundraiser stores
   • affiliate_links - Custom tracking links & QR codes
```

✅ **If you see this message, database is ready!**

---

### **STEP 2: Run TEST-CJ-PRODUCT-INSERT.sql**

1. Still in Supabase SQL Editor
2. Click "New Query"
3. Open: `project/project/TEST-CJ-PRODUCT-INSERT.sql`
4. Copy ALL the SQL
5. Paste into Supabase SQL Editor
6. Click "RUN"

**Expected Output:**
```
SUCCESS! Test product created with ID: abc-123-def-456
Seller ID: xyz-789
Product: Test CJ Wireless Earbuds Pro
Price: $49.99
Commission: 30%
```

✅ **If you see this message, test product is created!**

---

## 🧪 TESTING THE WORKFLOW

### **Test 1: Verify Product in Database**

Run this in Supabase SQL Editor:
```sql
SELECT 
  id, 
  title, 
  price, 
  affiliate_commission_rate, 
  is_promotable,
  is_active,
  dropship_provider
FROM products 
WHERE title = 'Test CJ Wireless Earbuds Pro';
```

**Expected:**
- 1 row returned
- `is_promotable = true`
- `is_active = true`
- `dropship_provider = 'cj'`
- `affiliate_commission_rate = 30`

✅ **Product is in database!**

---

### **Test 2: Check Marketplace Display**

Run this in Supabase SQL Editor:
```sql
SELECT 
  id,
  title,
  price,
  affiliate_commission_rate,
  is_promotable
FROM products 
WHERE is_promotable = true 
  AND is_active = true;
```

**Expected:**
- Test product appears in results
- Shows $49.99 price
- Shows 30% commission

✅ **Product will appear in marketplace!**

---

### **Test 3: Verify Tables Exist**

Run this in Supabase SQL Editor:
```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'products',
    'cj_product_mappings',
    'storefront_products',
    'affiliate_links'
  );
```

**Expected:**
```
products
cj_product_mappings
storefront_products
affiliate_links
```

✅ **All tables exist!**

---

## 🎯 FRONTEND TESTING

### **1. Test Marketplace Page**

1. Go to: https://beezio.co/marketplace
2. Should see "Test CJ Wireless Earbuds Pro"
3. Price: $49.99
4. Commission badge: "30% Commission"

### **2. Test Add to Store (Manual SQL)**

If you have an affiliate account:
```sql
-- Replace USER_ID and PRODUCT_ID with your actual IDs
INSERT INTO storefront_products (profile_id, product_id)
VALUES ('YOUR_USER_ID', 'TEST_PRODUCT_ID');

-- Verify it was added
SELECT * FROM storefront_products 
WHERE profile_id = 'YOUR_USER_ID';
```

### **3. Test Custom Link Creation (Manual SQL)**

```sql
-- Create test affiliate link
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

-- Verify link was created
SELECT * FROM affiliate_links 
WHERE profile_id = 'YOUR_USER_ID';
```

---

## 🚨 CJ API IMPORT (When Rate Limit Resets)

**IMPORTANT:** CJ API is rate limited to **1 request per 5 minutes**

### **When Ready to Import Real Products:**

1. Go to: https://beezio.co/admin
2. Navigate to "CJ Product Import"
3. Products should load (if rate limit has reset)
4. Select a product
5. Set pricing:
   - **Markup: 115%** (default)
   - **Commission: 30%** (default)
6. Click "Import Product"

**Expected:**
- ✅ Product created in database
- ✅ `is_promotable = true` automatically set
- ✅ `dropship_provider = 'cj'` automatically set
- ✅ Product appears in marketplace immediately
- ✅ Affiliates can add to their stores

---

## 📊 COMPLETE WORKFLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                      │
│        (https://beezio.co/admin → CJ Import)            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Imports product from CJ API
                   ▼
┌─────────────────────────────────────────────────────────┐
│                  PRODUCTS TABLE                         │
│  • is_promotable = true                                 │
│  • dropship_provider = 'cj'                             │
│  • affiliate_commission_rate = 30                       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Query: WHERE is_promotable = true
                   ▼
┌─────────────────────────────────────────────────────────┐
│                  MARKETPLACE PAGE                       │
│          (https://beezio.co/marketplace)                │
│  Shows all products with is_promotable = true           │
└──────────┬────────────────┬─────────────────────────────┘
           │                │
           ▼                ▼
    ┌──────────┐      ┌──────────┐      ┌────────────┐
    │AFFILIATE │      │  SELLER  │      │ FUNDRAISER │
    └────┬─────┘      └────┬─────┘      └─────┬──────┘
         │                 │                   │
         │  Clicks "Add to My Store"           │
         └─────────────────┴───────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │      STOREFRONT_PRODUCTS TABLE      │
         │  Links user → product they promote  │
         └─────────────────┬───────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │     CUSTOM STORE / DASHBOARD        │
         │  User's personalized product list   │
         └─────────────────┬───────────────────┘
                           │
         Clicks "Share" or "Get Link"
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │       AFFILIATE_LINKS TABLE         │
         │  • Custom link code (JASON-EARBUDS) │
         │  • QR code generation               │
         │  • Click tracking                   │
         │  • Conversion tracking              │
         │  • Earnings tracking                │
         └─────────────────────────────────────┘
```

---

## ✅ SUCCESS CHECKLIST

- [ ] Ran `FIX-PRODUCTS-TABLE-FOR-CJ.sql`
- [ ] Saw success message with table names
- [ ] Ran `TEST-CJ-PRODUCT-INSERT.sql`
- [ ] Saw product UUID in output
- [ ] Verified product in database (SQL query)
- [ ] Verified `is_promotable = true`
- [ ] Verified `dropship_provider = 'cj'`
- [ ] Checked marketplace at https://beezio.co/marketplace
- [ ] Test product appears in marketplace
- [ ] Frontend deployed to https://beezio.co

---

## 🔄 NEXT ACTIONS

### **Immediate:**
1. ✅ Run the 2 SQL files (FIX-PRODUCTS-TABLE-FOR-CJ.sql, TEST-CJ-PRODUCT-INSERT.sql)
2. ✅ Verify test product appears in database
3. ✅ Check marketplace page displays product

### **After Rate Limit (5+ minutes):**
4. Import real CJ product from admin dashboard
5. Verify it appears in marketplace
6. Test adding to affiliate store
7. Test custom link generation

### **Full Testing:**
8. Complete purchase flow
9. Verify commission calculation
10. Test QR code generation
11. Test click tracking

---

## 📞 TROUBLESHOOTING

### **Issue: SQL fails with "column doesn't exist"**
**Solution:** Tables already have the columns! Continue to next step.

### **Issue: Test product insert fails**
**Solution:** Check if you have a user with role 'seller' or 'admin':
```sql
SELECT id, email, role FROM profiles WHERE role IN ('seller', 'admin');
```

### **Issue: Product doesn't show in marketplace**
**Solution:** Verify flags:
```sql
UPDATE products 
SET is_promotable = true, is_active = true 
WHERE title = 'Test CJ Wireless Earbuds Pro';
```

### **Issue: CJ API still rate limited**
**Solution:** Wait 5+ minutes between API calls. Use test product for now.

---

## 🎉 YOU'RE READY!

**RUN THESE 2 SQL FILES IN ORDER:**
1. `FIX-PRODUCTS-TABLE-FOR-CJ.sql` ← Database schema
2. `TEST-CJ-PRODUCT-INSERT.sql` ← Test product

**Then test the complete workflow!**

---

**Questions? Check:** `CJ-COMPLETE-WORKFLOW-GUIDE.md` for detailed documentation
