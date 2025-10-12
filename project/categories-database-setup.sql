-- COMPLETE CATEGORY SETUP FOR BEEZIO MARKETPLACE
-- Run this in your Supabase SQL Editor to set up all categories with proper linking

-- ==============================================
-- 1. CREATE CATEGORIES TABLE WITH ALL FEATURES
-- ==============================================

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY, -- Using text IDs for easier referencing
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  icon TEXT, -- For UI icons
  parent_id TEXT REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  product_count INTEGER DEFAULT 0, -- Track number of products
  featured BOOLEAN DEFAULT false, -- For homepage display
  color_theme TEXT DEFAULT '#3B82F6', -- Category color for UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- 2. INSERT ALL CATEGORIES WITH FULL DETAILS
-- ==============================================

INSERT INTO categories (id, name, description, icon, sort_order, color_theme, featured) VALUES
  -- Main Categories
  ('electronics', 'Electronics', 'Phones, computers, tablets, gadgets and electronic devices', 'Smartphone', 1, '#8B5CF6', true),
  ('fashion', 'Fashion & Apparel', 'Clothing, shoes, accessories, jewelry and style items', 'Shirt', 2, '#EC4899', true),
  ('home-garden', 'Home & Garden', 'Home decor, furniture, gardening supplies, appliances', 'Home', 3, '#10B981', true),
  ('books-media', 'Books & Media', 'Physical books, ebooks, audiobooks, educational materials', 'Book', 4, '#F59E0B', true),
  ('sports-outdoors', 'Sports & Outdoors', 'Sports equipment, outdoor gear, fitness items, camping', 'Activity', 5, '#EF4444', true),
  ('beauty-personal-care', 'Beauty & Personal Care', 'Cosmetics, skincare, personal hygiene, grooming products', 'Sparkles', 6, '#F97316', true),
  ('health-wellness', 'Health & Wellness', 'Health products, supplements, wellness items, medical supplies', 'Heart', 7, '#06B6D4', true),
  ('technology', 'Technology', 'Software, apps, tech services, digital tools, SaaS products', 'Monitor', 8, '#6366F1', true),
  ('arts-crafts', 'Arts & Crafts', 'Art supplies, craft materials, handmade items, creative tools', 'Palette', 9, '#8B5CF6', false),
  ('automotive', 'Automotive', 'Car parts, accessories, automotive tools, vehicle maintenance', 'Car', 10, '#374151', false),
  ('pet-supplies', 'Pet Supplies', 'Pet food, toys, accessories, care products for animals', 'Dog', 11, '#059669', false),
  ('toys-games', 'Toys & Games', 'Toys, board games, video games, entertainment products', 'Gamepad2', 12, '#DC2626', false),
  ('education', 'Education & Courses', 'Online courses, educational materials, training programs, tutorials', 'GraduationCap', 13, '#7C3AED', true),
  ('services', 'Services', 'Professional services, consulting, freelance work, business services', 'Users', 14, '#0891B2', false),
  ('digital-products', 'Digital Products', 'Digital downloads, software, templates, digital content', 'Download', 15, '#7C2D12', true),
  ('food-beverages', 'Food & Beverages', 'Food items, drinks, meal kits, specialty foods', 'Coffee', 16, '#EA580C', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  color_theme = EXCLUDED.color_theme,
  featured = EXCLUDED.featured,
  updated_at = NOW();

-- ==============================================
-- 3. SET UP ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read categories
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

-- ==============================================
-- 4. GRANT PROPER PERMISSIONS
-- ==============================================

-- Grant read access to categories
GRANT SELECT ON categories TO anon, authenticated;
GRANT ALL ON categories TO service_role;

-- ==============================================
-- 5. VERIFICATION QUERY
-- ==============================================

-- Show setup results
SELECT 
  'SETUP COMPLETE!' as status,
  COUNT(*) as total_categories,
  COUNT(*) FILTER (WHERE featured = true) as featured_categories
FROM categories;