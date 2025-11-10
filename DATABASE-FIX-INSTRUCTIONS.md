# 🔧 DATABASE FIXES REQUIRED

## Missing Tables Found

Your database is missing 3 critical tables. Here's how to fix it:

---

## ⚡ QUICK FIX (Recommended)

### Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your project: `yemgssttxhkgrivuodbz`
3. Click **SQL Editor** in the left sidebar

### Step 2: Run This SQL

Copy and paste this entire SQL script into the SQL Editor and click **RUN**:

```sql
-- Create affiliate_store_products table
CREATE TABLE IF NOT EXISTS affiliate_store_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES affiliate_stores(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now() NOT NULL,
  display_order integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  UNIQUE(store_id, product_id)
);

-- Create product_reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(product_id, buyer_id)
);

-- Create seller_reviews table
CREATE TABLE IF NOT EXISTS seller_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(seller_id, buyer_id)
);

-- Enable RLS
ALTER TABLE affiliate_store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view affiliate store products"
  ON affiliate_store_products FOR SELECT USING (true);

CREATE POLICY "Affiliates can manage their store products"
  ON affiliate_store_products FOR ALL
  USING (store_id IN (SELECT id FROM affiliate_stores WHERE profile_id = auth.uid()));

CREATE POLICY "Anyone can view product reviews"
  ON product_reviews FOR SELECT USING (true);

CREATE POLICY "Buyers can create their own reviews"
  ON product_reviews FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers can update their own reviews"
  ON product_reviews FOR UPDATE
  USING (buyer_id = auth.uid());

CREATE POLICY "Anyone can view seller reviews"
  ON seller_reviews FOR SELECT USING (true);

CREATE POLICY "Buyers can create seller reviews"
  ON seller_reviews FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers can update their own seller reviews"
  ON seller_reviews FOR UPDATE
  USING (buyer_id = auth.uid());

-- Create indexes
CREATE INDEX idx_affiliate_store_products_store ON affiliate_store_products(store_id);
CREATE INDEX idx_affiliate_store_products_product ON affiliate_store_products(product_id);
CREATE INDEX idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX idx_seller_reviews_seller ON seller_reviews(seller_id);
```

### Step 3: Create Storage Buckets

Still in Supabase Dashboard:

1. Click **Storage** in the left sidebar
2. Click **New bucket**
3. Name: `product-images`, check ✅ **Public bucket**, click **Create**
4. Click **New bucket** again
5. Name: `profile-avatars`, check ✅ **Public bucket**, click **Create**

### Step 4: Verify Fixes

Run this command:
```bash
node test-all-systems.js
```

You should see **0 issues**.

---

## 📊 What This Fixes

✅ **affiliate_store_products** - Allows affiliates to curate products in their stores
✅ **product_reviews** - Enables buyer reviews on products
✅ **seller_reviews** - Enables buyer reviews of sellers
✅ **Storage buckets** - Enables image uploads for products and avatars

---

## ⏱️ Time Required

- **5 minutes** to run the SQL
- **2 minutes** to create storage buckets
- **Total: ~7 minutes**

---

## 🆘 Need Help?

If you get any errors:
1. Make sure you're logged into the correct Supabase project
2. The SQL might already be partially run - that's okay, it won't duplicate
3. Screenshot any errors and I can help debug

---

## ✅ After This

Once complete, ALL critical systems will be operational and you can:
- Test product uploads
- Test affiliate stores
- Test reviews system
- Deploy to production

