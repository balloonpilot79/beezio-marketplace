-- QUICK FIX FOR ALL THREE ISSUES
-- Run this in your Supabase SQL Editor

-- 1. CREATE CATEGORIES TABLE AND DATA
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert categories
INSERT INTO categories (id, name, description, sort_order) VALUES
  ('electronics', 'Electronics', 'Phones, computers, tablets, gadgets and electronic devices', 1),
  ('fashion', 'Fashion & Apparel', 'Clothing, shoes, accessories, jewelry and style items', 2),
  ('home-garden', 'Home & Garden', 'Home decor, furniture, gardening supplies, appliances', 3),
  ('books-media', 'Books & Media', 'Physical books, ebooks, audiobooks, educational materials', 4),
  ('sports-outdoors', 'Sports & Outdoors', 'Sports equipment, outdoor gear, fitness items, camping', 5),
  ('beauty-personal-care', 'Beauty & Personal Care', 'Cosmetics, skincare, personal hygiene, grooming products', 6),
  ('health-wellness', 'Health & Wellness', 'Health products, supplements, wellness items, medical supplies', 7),
  ('technology', 'Technology', 'Software, apps, tech services, digital tools, SaaS products', 8),
  ('arts-crafts', 'Arts & Crafts', 'Art supplies, craft materials, handmade items, creative tools', 9),
  ('automotive', 'Automotive', 'Car parts, accessories, automotive tools, vehicle maintenance', 10),
  ('pet-supplies', 'Pet Supplies', 'Pet food, toys, accessories, care products for animals', 11),
  ('toys-games', 'Toys & Games', 'Toys, board games, video games, entertainment products', 12),
  ('education', 'Education & Courses', 'Online courses, educational materials, training programs, tutorials', 13),
  ('services', 'Services', 'Professional services, consulting, freelance work, business services', 14),
  ('digital-products', 'Digital Products', 'Digital downloads, software, templates, digital content', 15),
  ('food-beverages', 'Food & Beverages', 'Food items, drinks, meal kits, specialty foods', 16)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS and set policies for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

-- Grant permissions
GRANT SELECT ON categories TO anon, authenticated;

-- 2. ENSURE PRODUCTS TABLE HAS PROPER COLUMNS
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES categories(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 20;
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT 'percentage';

-- Update existing products to have category info
UPDATE products 
SET category_name = 'Electronics', category_id = 'electronics'
WHERE category_name IS NULL OR category_id IS NULL;

-- 3. CREATE STORAGE BUCKETS (if they don't exist)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-images', 'product-images', true),
  ('user-avatars', 'user-avatars', true),
  ('store-branding', 'store-branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. SHOW RESULTS
SELECT 
  'Setup complete!' as status,
  (SELECT COUNT(*) FROM categories) as categories_count,
  (SELECT COUNT(*) FROM products) as products_count;

-- Show categories
SELECT id, name FROM categories ORDER BY sort_order;