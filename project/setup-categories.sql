-- Setup Categories for Beezio Marketplace
-- Run this in your Supabase SQL Editor

-- Create categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clear existing categories (optional - remove this line if you want to keep existing data)
-- DELETE FROM categories;

-- Insert categories with descriptions
INSERT INTO categories (id, name, description, sort_order) VALUES
  ('electronics', 'Electronics', 'Phones, computers, gadgets and electronic devices', 1),
  ('fashion', 'Fashion & Apparel', 'Clothing, shoes, accessories and style items', 2),
  ('home-garden', 'Home & Garden', 'Home decor, furniture, gardening supplies', 3),
  ('books-media', 'Books & Media', 'Physical books, digital content and educational materials', 4),
  ('sports-outdoors', 'Sports & Outdoors', 'Sports equipment, outdoor gear, fitness items', 5),
  ('beauty-personal-care', 'Beauty & Personal Care', 'Cosmetics, skincare, personal hygiene products', 6),
  ('health-wellness', 'Health & Wellness', 'Health products, supplements, wellness items', 7),
  ('technology', 'Technology', 'Software, apps, tech services and digital tools', 8),
  ('arts-crafts', 'Arts & Crafts', 'Art supplies, craft materials, handmade items', 9),
  ('automotive', 'Automotive', 'Car parts, accessories, automotive tools', 10),
  ('pet-supplies', 'Pet Supplies', 'Pet food, toys, accessories and care products', 11),
  ('toys-games', 'Toys & Games', 'Toys, board games, video games and entertainment', 12),
  ('education', 'Education & Courses', 'Online courses, educational materials, training', 13),
  ('services', 'Services', 'Professional services, consulting, freelance work', 14),
  ('digital-products', 'Digital Products', 'Digital downloads, software, templates', 15),
  ('food-beverages', 'Food & Beverages', 'Food items, drinks, meal kits', 16)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Enable RLS (Row Level Security) for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to read categories
CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

-- Create policy to allow admins to manage categories (optional)
CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT ON categories TO anon, authenticated;
GRANT ALL ON categories TO service_role;

SELECT 'Categories setup complete! ' || COUNT(*) || ' categories created.' as result
FROM categories;