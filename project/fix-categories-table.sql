-- Fix Categories Table - Step by Step
-- Run this in Supabase SQL Editor

-- Step 1: Check what columns exist in the categories table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'categories' 
AND table_schema = 'public';

-- Step 2: Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add is_active column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.categories ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    -- Add display_order column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'display_order'
    ) THEN
        ALTER TABLE public.categories ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;

    -- Add description column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.categories ADD COLUMN description TEXT;
    END IF;

    -- Add icon column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'icon'
    ) THEN
        ALTER TABLE public.categories ADD COLUMN icon TEXT;
    END IF;

    -- Add parent_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'parent_id'
    ) THEN
        ALTER TABLE public.categories ADD COLUMN parent_id UUID REFERENCES public.categories(id);
    END IF;

    -- Add slug column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'categories' 
        AND column_name = 'slug'
    ) THEN
        ALTER TABLE public.categories ADD COLUMN slug TEXT;
    END IF;
END $$;

-- Step 3: Update is_active to true for all existing rows
UPDATE public.categories SET is_active = true WHERE is_active IS NULL;

-- Step 4: Generate slugs for existing categories if they don't have them
UPDATE public.categories 
SET slug = LOWER(REPLACE(name, ' & ', '-'))
WHERE slug IS NULL OR slug = '';

UPDATE public.categories 
SET slug = LOWER(REPLACE(slug, ' ', '-'))
WHERE slug IS NOT NULL;

-- Step 5: Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to categories" ON public.categories;
DROP POLICY IF EXISTS "Allow authenticated full read access to categories" ON public.categories;

-- Step 7: Create policies
CREATE POLICY "Allow public read access to categories"
ON public.categories FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Allow authenticated full read access to categories"
ON public.categories FOR SELECT
TO authenticated
USING (true);

-- Step 8: Insert categories if they don't exist
INSERT INTO public.categories (name, slug, description, display_order, is_active) VALUES
('Electronics', 'electronics', 'Electronic devices and accessories', 1, true),
('Fashion & Apparel', 'fashion-apparel', 'Clothing, shoes, and accessories', 2, true),
('Home & Garden', 'home-garden', 'Home decor, furniture, and garden supplies', 3, true),
('Sports & Outdoors', 'sports-outdoors', 'Sports equipment and outdoor gear', 4, true),
('Books & Media', 'books-media', 'Books, movies, music, and games', 5, true),
('Toys & Games', 'toys-games', 'Toys, games, and hobbies', 6, true),
('Health & Beauty', 'health-beauty', 'Health products and beauty supplies', 7, true),
('Automotive', 'automotive', 'Car parts and accessories', 8, true),
('Food & Beverage', 'food-beverage', 'Food, drinks, and groceries', 9, true),
('Pet Supplies', 'pet-supplies', 'Pet food, toys, and accessories', 10, true),
('Office & Business', 'office-business', 'Office supplies and business equipment', 11, true),
('Arts & Crafts', 'arts-crafts', 'Art supplies and craft materials', 12, true),
('Baby & Kids', 'baby-kids', 'Baby products and children items', 13, true),
('Music & Instruments', 'music-instruments', 'Musical instruments and equipment', 14, true),
('Jewelry & Watches', 'jewelry-watches', 'Jewelry, watches, and accessories', 15, true),
('Other', 'other', 'Miscellaneous items', 16, true)
ON CONFLICT (name) DO UPDATE SET 
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

-- Step 9: Verify the categories
SELECT id, name, slug, is_active, display_order FROM public.categories ORDER BY display_order;
