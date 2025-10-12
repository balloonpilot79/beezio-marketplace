-- COMPLETE CATEGORY SETUP FOR BEEZIO MARKETPLACE
-- Run this entire script in your Supabase SQL Editor
-- This ensures all categories work with products, images, and listings

-- ============================================================================
-- STEP 1: CREATE CATEGORIES TABLE WITH ALL NECESSARY FIELDS
-- ============================================================================

-- Drop existing table if you want to start fresh (OPTIONAL - remove comment to use)
-- DROP TABLE IF EXISTS categories CASCADE;

-- Create categories table with all required fields
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,  -- Using TEXT for predictable IDs
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  image_url TEXT,
  icon_name TEXT,  -- For UI icons
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  allows_physical_products BOOLEAN DEFAULT true,
  allows_digital_products BOOLEAN DEFAULT true,
  allows_subscription_products BOOLEAN DEFAULT true,
  requires_shipping BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: INSERT ALL CATEGORIES WITH COMPLETE CONFIGURATION
-- ============================================================================

-- Clear existing data (OPTIONAL - remove comment to use)
-- DELETE FROM categories;

-- Insert all categories with full configuration
INSERT INTO categories (
  id, 
  name, 
  description, 
  icon_name, 
  sort_order, 
  allows_physical_products, 
  allows_digital_products, 
  allows_subscription_products, 
  requires_shipping
) VALUES
  ('electronics', 'Electronics', 'Phones, computers, gadgets, and electronic devices', 'Smartphone', 1, true, true, true, true),
  ('fashion', 'Fashion & Apparel', 'Clothing, shoes, accessories, and style items', 'Shirt', 2, true, false, true, true),
  ('home-garden', 'Home & Garden', 'Home decor, furniture, gardening supplies, and household items', 'Home', 3, true, true, false, true),
  ('books-media', 'Books & Media', 'Physical books, ebooks, audiobooks, and educational materials', 'Book', 4, true, true, true, true),
  ('sports-outdoors', 'Sports & Outdoors', 'Sports equipment, outdoor gear, fitness items, and athletic wear', 'Dumbbell', 5, true, true, true, true),
  ('beauty-personal-care', 'Beauty & Personal Care', 'Cosmetics, skincare, personal hygiene, and beauty products', 'Sparkles', 6, true, false, true, true),
  ('health-wellness', 'Health & Wellness', 'Health products, supplements, wellness items, and fitness programs', 'Heart', 7, true, true, true, true),
  ('technology', 'Technology', 'Software, apps, tech services, and digital tools', 'Laptop', 8, false, true, true, false),
  ('arts-crafts', 'Arts & Crafts', 'Art supplies, craft materials, handmade items, and creative tools', 'Palette', 9, true, true, false, true),
  ('automotive', 'Automotive', 'Car parts, accessories, automotive tools, and vehicle supplies', 'Car', 10, true, true, false, true),
  ('pet-supplies', 'Pet Supplies', 'Pet food, toys, accessories, and care products for animals', 'Dog', 11, true, false, true, true),
  ('toys-games', 'Toys & Games', 'Toys, board games, video games, and entertainment products', 'Gamepad2', 12, true, true, false, true),
  ('education', 'Education & Courses', 'Online courses, educational materials, training programs, and learning resources', 'GraduationCap', 13, false, true, true, false),
  ('services', 'Services', 'Professional services, consulting, freelance work, and expertise', 'Users', 14, false, true, true, false),
  ('digital-products', 'Digital Products', 'Digital downloads, software, templates, and digital assets', 'Download', 15, false, true, true, false),
  ('food-beverages', 'Food & Beverages', 'Food items, drinks, meal kits, and culinary products', 'Coffee', 16, true, false, true, true),
  ('business-industrial', 'Business & Industrial', 'Business equipment, industrial supplies, and commercial products', 'Building', 17, true, true, false, true),
  ('music-instruments', 'Music & Instruments', 'Musical instruments, audio equipment, and music-related products', 'Music', 18, true, true, true, true),
  ('collectibles', 'Collectibles & Antiques', 'Collectible items, antiques, vintage products, and rare finds', 'Star', 19, true, false, false, true),
  ('baby-kids', 'Baby & Kids', 'Baby products, children items, toys, and family essentials', 'Baby', 20, true, false, true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon_name = EXCLUDED.icon_name,
  sort_order = EXCLUDED.sort_order,
  allows_physical_products = EXCLUDED.allows_physical_products,
  allows_digital_products = EXCLUDED.allows_digital_products,
  allows_subscription_products = EXCLUDED.allows_subscription_products,
  requires_shipping = EXCLUDED.requires_shipping,
  updated_at = NOW();

-- ============================================================================
-- STEP 3: UPDATE PRODUCTS TABLE TO LINK WITH CATEGORIES
-- ============================================================================

-- Ensure products table has correct category relationship
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES categories(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active, sort_order);

-- ============================================================================
-- STEP 4: SET UP ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on categories table
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;

-- Allow everyone to read active categories
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (is_active = true);

-- Allow authenticated users to read all categories (including inactive for admin purposes)
CREATE POLICY "Authenticated users can view all categories" ON categories
  FOR SELECT TO authenticated USING (true);

-- Allow admins to manage categories
CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- STEP 5: GRANT PROPER PERMISSIONS
-- ============================================================================

-- Grant read access to anonymous and authenticated users
GRANT SELECT ON categories TO anon, authenticated;

-- Grant full access to service role (for admin operations)
GRANT ALL ON categories TO service_role;

-- ============================================================================
-- STEP 6: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to get categories for dropdown (active only)
CREATE OR REPLACE FUNCTION get_active_categories()
RETURNS TABLE (
  id TEXT,
  name TEXT,
  description TEXT,
  icon_name TEXT,
  allows_physical_products BOOLEAN,
  allows_digital_products BOOLEAN,
  allows_subscription_products BOOLEAN,
  requires_shipping BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.icon_name,
    c.allows_physical_products,
    c.allows_digital_products,
    c.allows_subscription_products,
    c.requires_shipping
  FROM categories c
  WHERE c.is_active = true
  ORDER BY c.sort_order ASC, c.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_active_categories() TO anon, authenticated;

-- ============================================================================
-- STEP 7: CREATE SAMPLE PRODUCTS FOR TESTING (OPTIONAL)
-- ============================================================================

-- Uncomment the section below if you want to create sample products for testing

/*
-- Insert sample products for each category to test functionality
INSERT INTO products (
  id,
  title,
  description,
  price,
  category_id,
  seller_id,
  images,
  stock_quantity,
  commission_rate,
  is_active
) VALUES
  (gen_random_uuid(), 'Sample Electronics Product', 'A sample electronic device for testing', 99.99, 'electronics', (SELECT user_id FROM profiles LIMIT 1), ARRAY['https://via.placeholder.com/400x400?text=Electronics'], 10, 15.0, true),
  (gen_random_uuid(), 'Sample Fashion Item', 'A sample fashion product for testing', 49.99, 'fashion', (SELECT user_id FROM profiles LIMIT 1), ARRAY['https://via.placeholder.com/400x400?text=Fashion'], 25, 20.0, true),
  (gen_random_uuid(), 'Sample Digital Course', 'A sample online course for testing', 199.99, 'education', (SELECT user_id FROM profiles LIMIT 1), ARRAY['https://via.placeholder.com/400x400?text=Course'], 999, 30.0, true)
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================================================
-- STEP 8: VERIFICATION QUERIES
-- ============================================================================

-- Verify categories were created
SELECT 
  'Categories created successfully!' as status,
  COUNT(*) as total_categories,
  COUNT(*) FILTER (WHERE is_active = true) as active_categories
FROM categories;

-- Show all categories with their configuration
SELECT 
  id,
  name,
  allows_physical_products as physical,
  allows_digital_products as digital,
  allows_subscription_products as subscription,
  requires_shipping as shipping,
  is_active as active
FROM categories 
ORDER BY sort_order;

-- Test the helper function
SELECT * FROM get_active_categories() LIMIT 5;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================

SELECT 'CATEGORY SETUP COMPLETE!' as result,
       'All categories are now configured and ready for products with images and listings.' as message;