-- Seed hierarchical marketplace categories (safe, idempotent)
-- Adds Clothing/Shoes with Men/Women/Boys/Girls subcategories.

DO $$
DECLARE
  clothing_id uuid;
  shoes_id uuid;
BEGIN
  -- Parents
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'clothing') THEN
    INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
    VALUES ('Clothing', 'clothing', 'Men, women, boys, girls apparel', 'Shirt', NULL, now());
  END IF;
  SELECT id INTO clothing_id FROM public.categories WHERE slug = 'clothing' LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'shoes') THEN
    INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
    VALUES ('Shoes', 'shoes', 'Men, women, boys, girls shoes', 'Footprints', NULL, now());
  END IF;
  SELECT id INTO shoes_id FROM public.categories WHERE slug = 'shoes' LIMIT 1;

  -- Clothing children
  IF clothing_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'mens-clothing') THEN
      INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
      VALUES ('Men''s Clothing', 'mens-clothing', 'Apparel for men', 'User', clothing_id, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'womens-clothing') THEN
      INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
      VALUES ('Women''s Clothing', 'womens-clothing', 'Apparel for women', 'User', clothing_id, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'boys-clothing') THEN
      INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
      VALUES ('Boys'' Clothing', 'boys-clothing', 'Apparel for boys', 'Baby', clothing_id, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'girls-clothing') THEN
      INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
      VALUES ('Girls'' Clothing', 'girls-clothing', 'Apparel for girls', 'Baby', clothing_id, now());
    END IF;
  END IF;

  -- Shoes children
  IF shoes_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'mens-shoes') THEN
      INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
      VALUES ('Men''s Shoes', 'mens-shoes', 'Shoes for men', 'Footprints', shoes_id, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'womens-shoes') THEN
      INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
      VALUES ('Women''s Shoes', 'womens-shoes', 'Shoes for women', 'Footprints', shoes_id, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'boys-shoes') THEN
      INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
      VALUES ('Boys'' Shoes', 'boys-shoes', 'Shoes for boys', 'Footprints', shoes_id, now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'girls-shoes') THEN
      INSERT INTO public.categories (name, slug, description, icon_name, parent_id, created_at)
      VALUES ('Girls'' Shoes', 'girls-shoes', 'Shoes for girls', 'Footprints', shoes_id, now());
    END IF;
  END IF;
END $$;

