-- ========================================
-- COMPLETE CATEGORY SETUP FOR BEEZIO MARKETPLACE
-- ========================================
-- Copy and paste this entire script into your Supabase SQL Editor
-- This will create all categories and ensure they work properly

-- Step 1: Create categories table with proper structure
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,  -- Using TEXT instead of UUID for easier matching
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  parent_id TEXT REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Clear existing categories if any exist (optional)
DELETE FROM categories WHERE id IN (
  'electronics', 'fashion', 'home-garden', 'books-media', 'sports-outdoors',
  'beauty-personal-care', 'health-wellness', 'technology', 'arts-crafts',
  'automotive', 'pet-supplies', 'toys-games', 'education', 'services',
  'digital-products', 'food-beverages'
);

-- Step 3: Insert all categories with detailed descriptions
INSERT INTO categories (id, name, description, sort_order, is_active) VALUES
  ('electronics', 'Electronics', 'Smartphones, laptops, tablets, smart home devices, audio equipment, and all electronic gadgets', 1, true),
  ('fashion', 'Fashion & Apparel', 'Clothing, shoes, handbags, jewelry, accessories, and fashion items for men, women, and children', 2, true),
  ('home-garden', 'Home & Garden', 'Home decor, furniture, kitchen appliances, gardening tools, plants, and home improvement items', 3, true),
  ('books-media', 'Books & Media', 'Physical books, e-books, audiobooks, movies, music, magazines, and educational content', 4, true),
  ('sports-outdoors', 'Sports & Outdoors', 'Sports equipment, outdoor gear, fitness accessories, camping supplies, and athletic wear', 5, true),
  ('beauty-personal-care', 'Beauty & Personal Care', 'Cosmetics, skincare products, hair care, perfumes, and personal hygiene items', 6, true),
  ('health-wellness', 'Health & Wellness', 'Vitamins, supplements, health monitoring devices, wellness products, and fitness equipment', 7, true),
  ('technology', 'Technology', 'Software, mobile apps, digital tools, tech services, and technology-related products', 8, true),
  ('arts-crafts', 'Arts & Crafts', 'Art supplies, craft materials, DIY kits, handmade items, and creative tools', 9, true),
  ('automotive', 'Automotive', 'Car accessories, auto parts, tools, cleaning supplies, and vehicle maintenance products', 10, true),
  ('pet-supplies', 'Pet Supplies', 'Pet food, toys, grooming supplies, pet accessories, and animal care products', 11, true),
  ('toys-games', 'Toys & Games', 'Children''s toys, board games, video games, puzzles, and entertainment products', 12, true),
  ('education', 'Education & Courses', 'Online courses, educational materials, tutorials, training programs, and learning resources', 13, true),
  ('services', 'Services', 'Professional services, consulting, freelance work, coaching, and service-based offerings', 14, true),
  ('digital-products', 'Digital Products', 'Digital downloads, templates, software, e-books, digital art, and downloadable content', 15, true),
  ('food-beverages', 'Food & Beverages', 'Gourmet foods, beverages, snacks, meal kits, and specialty food items', 16, true);

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Public read access to categories" ON categories;
DROP POLICY IF EXISTS "Admin full access to categories" ON categories;

-- Step 6: Create public read policy (everyone can view categories)
CREATE POLICY "Public read access to categories" ON categories
  FOR SELECT 
  TO public
  USING (is_active = true);

-- Step 7: Create admin management policy (admins can manage categories)
CREATE POLICY "Admin full access to categories" ON categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Step 8: Grant proper permissions
GRANT SELECT ON categories TO anon;
GRANT SELECT ON categories TO authenticated;
GRANT ALL ON categories TO service_role;

-- Step 9: Update products table to ensure category_id is TEXT (not UUID)
-- This ensures compatibility with the new category IDs
ALTER TABLE products ALTER COLUMN category_id TYPE TEXT;

-- Step 10: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Step 11: Verify the setup
DO $$
DECLARE
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO category_count FROM categories WHERE is_active = true;
  RAISE NOTICE 'SUCCESS: % active categories created!', category_count;
  
  -- List all categories
  FOR rec IN SELECT id, name, sort_order FROM categories ORDER BY sort_order LOOP
    RAISE NOTICE 'Category: % - % (ID: %)', rec.sort_order, rec.name, rec.id;
  END LOOP;
END $$;

-- Step 12: Test query that ProductForm will use
SELECT 'TEST: Categories ready for ProductForm!' as status;
SELECT id, name, description FROM categories WHERE is_active = true ORDER BY sort_order;

-- ========================================
-- SETUP COMPLETE!
-- ========================================
-- All 16 categories are now properly set up and ready to use
-- The ProductForm component will be able to load these categories
-- Each category has a unique ID that matches the fallback categories in the code