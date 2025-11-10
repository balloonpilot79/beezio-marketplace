# 📊 SUPABASE SQL SETUP - STEP BY STEP GUIDE

## 🎯 What You Need To Do

You need to run SQL code in Supabase to create the new database tables for custom pages, product ordering, and affiliate store settings.

---

## 📍 WHERE TO GO

### Step 1: Open Supabase Dashboard
1. Go to [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Select your **Beezio** project

### Step 2: Navigate to SQL Editor
1. On the left sidebar, click **"SQL Editor"** (icon looks like `</>`)
2. Click **"New Query"** button (top right)

---

## 📋 WHAT TO RUN

### Option A: Copy from File (RECOMMENDED)
1. Open this file: `project\supabase\migrations\custom_store_enhancements.sql`
2. **Copy ALL the SQL code** (it's about 130 lines)
3. **Paste it** into the Supabase SQL Editor
4. Click **"Run"** button (or press Ctrl+Enter)

### Option B: Copy from Below
If you can't access the file, here's the complete SQL:

```sql
-- Enhanced Store System with Custom Pages and Product Management
-- Run this in Supabase SQL Editor

-- 1. Add custom pages table for sellers and affiliates
CREATE TABLE IF NOT EXISTS custom_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('seller', 'affiliate')),
  page_slug VARCHAR(100) NOT NULL,
  page_title VARCHAR(200) NOT NULL,
  page_content TEXT, -- HTML content
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, page_slug)
);

-- 2. Add product display order for sellers
CREATE TABLE IF NOT EXISTS seller_product_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seller_id, product_id)
);

-- 3. Add affiliate product selections (which marketplace products they want to promote)
CREATE TABLE IF NOT EXISTS affiliate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(affiliate_id, product_id)
);

-- 4. Add product_order column to products table for global ordering
ALTER TABLE products ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- 5. Add theme_settings JSON column for advanced customization
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{
  "primary_color": "#ffcc00",
  "secondary_color": "#000000",
  "font_family": "Poppins",
  "layout": "grid"
}'::jsonb;

-- 6. Add affiliate_store_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS affiliate_store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  store_name VARCHAR(200),
  description TEXT,
  banner_url TEXT,
  logo_url TEXT,
  theme VARCHAR(50) DEFAULT 'modern',
  theme_settings JSONB DEFAULT '{
    "primary_color": "#ffcc00",
    "secondary_color": "#000000",
    "font_family": "Poppins",
    "layout": "grid"
  }'::jsonb,
  social_links JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enable RLS on new tables
ALTER TABLE custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_product_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_store_settings ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for custom_pages
CREATE POLICY "Users can view their own pages" ON custom_pages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = owner_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view active pages" ON custom_pages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage their own pages" ON custom_pages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = owner_id AND profiles.user_id = auth.uid())
  );

-- 9. RLS Policies for seller_product_order
CREATE POLICY "Sellers can manage their product order" ON seller_product_order
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = seller_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view product order" ON seller_product_order
  FOR SELECT USING (true);

-- 10. RLS Policies for affiliate_products
CREATE POLICY "Affiliates can manage their products" ON affiliate_products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view affiliate products" ON affiliate_products
  FOR SELECT USING (true);

-- 11. RLS Policies for affiliate_store_settings
CREATE POLICY "Affiliates can manage their store settings" ON affiliate_store_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = affiliate_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view affiliate store settings" ON affiliate_store_settings
  FOR SELECT USING (true);

-- 12. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_pages_owner ON custom_pages(owner_id, owner_type);
CREATE INDEX IF NOT EXISTS idx_custom_pages_slug ON custom_pages(page_slug);
CREATE INDEX IF NOT EXISTS idx_seller_product_order ON seller_product_order(seller_id, display_order);
CREATE INDEX IF NOT EXISTS idx_affiliate_products ON affiliate_products(affiliate_id, display_order);
CREATE INDEX IF NOT EXISTS idx_products_display_order ON products(display_order);

-- Done! Enhanced store system ready.
```

---

## ✅ HOW TO VERIFY IT WORKED

After running the SQL, you should see:

### Success Messages:
- "Success. No rows returned"
- OR individual success messages for each table/policy created

### Check Tables Were Created:
1. In Supabase, go to **"Table Editor"** (left sidebar)
2. You should see these NEW tables:
   - ✅ `custom_pages`
   - ✅ `seller_product_order`
   - ✅ `affiliate_products`
   - ✅ `affiliate_store_settings`

### Check Columns Were Added:
1. Click on **`products`** table
2. You should see a new column: `display_order`
3. Click on **`store_settings`** table
4. You should see a new column: `theme_settings`

---

## 🎨 BONUS: Setup Image Storage (Optional but Recommended)

### Step 1: Create Storage Bucket
1. In Supabase, go to **"Storage"** (left sidebar)
2. Click **"New Bucket"**
3. Bucket name: `store-images`
4. **Make it Public** ✅ (toggle the switch)
5. Click **"Create bucket"**

### Step 2: Create Folders (Optional)
You can create folders later when uploading, but if you want to organize now:
1. Click on the `store-images` bucket
2. Click "Create folder"
3. Create these folders:
   - `banners`
   - `logos`
   - `uploads`

---

## 🚨 TROUBLESHOOTING

### Error: "relation 'profiles' does not exist"
**Solution:** Run your main database setup first. The `profiles` table must exist before running this migration.

### Error: "relation 'products' does not exist"
**Solution:** Same as above - `products` table must exist first.

### Error: "permission denied"
**Solution:** Make sure you're logged in as the project owner in Supabase.

### Error: "column already exists"
**Solution:** That's fine! The SQL uses `IF NOT EXISTS` so it won't break if run multiple times.

---

## 📸 SCREENSHOT GUIDE

Here's what your screen should look like:

1. **Supabase Dashboard** → Left sidebar → Click "SQL Editor"
2. **SQL Editor** → Top right → Click "New Query"
3. **Paste the SQL code** in the editor
4. **Bottom right** → Click "Run" (or Ctrl+Enter)
5. **See success messages** in the Results panel

---

## ✨ AFTER RUNNING SQL

Once the SQL runs successfully, you can immediately test:

1. **Login as a seller** on your site
2. **Go to Dashboard → Store Settings**
3. **Click "Custom Pages" tab**
4. **Try creating a new page!**

The custom page builder, image upload, and theme system will all work after this SQL migration completes.

---

## 📞 NEED HELP?

If you get stuck or see errors, share:
1. The exact error message
2. A screenshot of the SQL Editor
3. What step you're on

I'll help you debug! 🚀
