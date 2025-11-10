-- Create missing tables for Beezio marketplace

-- 1. Create affiliate_store_products table (junction table)
CREATE TABLE IF NOT EXISTS public.affiliate_store_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id uuid REFERENCES public.affiliate_stores(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  added_at timestamptz DEFAULT now() NOT NULL,
  display_order integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  UNIQUE(store_id, product_id)
);

-- 2. Create product_reviews table
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(product_id, buyer_id)
);

-- 3. Create seller_reviews table  
CREATE TABLE IF NOT EXISTS public.seller_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  buyer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(seller_id, buyer_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_affiliate_store_products_store ON affiliate_store_products(store_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_store_products_product ON affiliate_store_products(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_buyer ON product_reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_seller_reviews_seller ON seller_reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_reviews_buyer ON seller_reviews(buyer_id);

-- Enable RLS on new tables
ALTER TABLE affiliate_store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for affiliate_store_products
DROP POLICY IF EXISTS "Anyone can view affiliate store products" ON affiliate_store_products;
CREATE POLICY "Anyone can view affiliate store products"
  ON affiliate_store_products FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Affiliates can manage their store products" ON affiliate_store_products;
CREATE POLICY "Affiliates can manage their store products"
  ON affiliate_store_products FOR ALL
  TO authenticated
  USING (
    store_id IN (
      SELECT id FROM affiliate_stores 
      WHERE profile_id = auth.uid()
    )
  );

-- RLS Policies for product_reviews
DROP POLICY IF EXISTS "Anyone can view product reviews" ON product_reviews;
CREATE POLICY "Anyone can view product reviews"
  ON product_reviews FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Buyers can create their own reviews" ON product_reviews;
CREATE POLICY "Buyers can create their own reviews"
  ON product_reviews FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Buyers can update their own reviews" ON product_reviews;
CREATE POLICY "Buyers can update their own reviews"
  ON product_reviews FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Buyers can delete their own reviews" ON product_reviews;
CREATE POLICY "Buyers can delete their own reviews"
  ON product_reviews FOR DELETE
  TO authenticated
  USING (buyer_id = auth.uid());

-- RLS Policies for seller_reviews
DROP POLICY IF EXISTS "Anyone can view seller reviews" ON seller_reviews;
CREATE POLICY "Anyone can view seller reviews"
  ON seller_reviews FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Buyers can create seller reviews" ON seller_reviews;
CREATE POLICY "Buyers can create seller reviews"
  ON seller_reviews FOR INSERT
  TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Buyers can update their own seller reviews" ON seller_reviews;
CREATE POLICY "Buyers can update their own seller reviews"
  ON seller_reviews FOR UPDATE
  TO authenticated
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Buyers can delete their own seller reviews" ON seller_reviews;
CREATE POLICY "Buyers can delete their own seller reviews"
  ON seller_reviews FOR DELETE
  TO authenticated
  USING (buyer_id = auth.uid());

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product-images
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Anyone can view product images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Users can update their own product images" ON storage.objects;
CREATE POLICY "Users can update their own product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own product images" ON storage.objects;
CREATE POLICY "Users can delete their own product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid());

-- Storage policies for profile-avatars
DROP POLICY IF EXISTS "Anyone can view profile avatars" ON storage.objects;
CREATE POLICY "Anyone can view profile avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'profile-avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'profile-avatars' AND owner = auth.uid());

-- Add updated_at trigger for reviews
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_product_reviews_updated_at ON product_reviews;
CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seller_reviews_updated_at ON seller_reviews;
CREATE TRIGGER update_seller_reviews_updated_at
  BEFORE UPDATE ON seller_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
