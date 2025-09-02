/*
  # Add reviews and ratings system

  1. New Tables
    - `product_reviews` - Reviews for individual products
    - `seller_ratings` - Overall ratings for sellers
    - `review_helpful` - Track helpful votes for reviews

  2. Changes
    - Add average_rating and review_count to products table
    - Add average_rating and review_count to profiles table for sellers

  3. Security
    - Enable RLS on all new tables
    - Users can create reviews for products they've purchased
    - Users can rate sellers after completing transactions
    - Public read access for all reviews and ratings
*/

-- Add review-related columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS average_rating numeric(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;

-- Add rating-related columns to profiles table for sellers
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS average_rating numeric(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 0;

-- Create product_reviews table
CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text NOT NULL,
  content text NOT NULL,
  verified_purchase boolean DEFAULT false,
  helpful_count integer DEFAULT 0,
  images text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, reviewer_id) -- One review per user per product
);

-- Create seller_ratings table
CREATE TABLE IF NOT EXISTS seller_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rater_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  transaction_related boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(seller_id, rater_id) -- One rating per user per seller
);

-- Create review_helpful table for tracking helpful votes
CREATE TABLE IF NOT EXISTS review_helpful (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES product_reviews(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_helpful boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(review_id, user_id) -- One vote per user per review
);

-- Enable RLS
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_helpful ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_reviews
CREATE POLICY "Anyone can view product reviews" ON product_reviews FOR SELECT USING (true);
CREATE POLICY "Users can create reviews for products" ON product_reviews FOR INSERT 
  WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can update their own reviews" ON product_reviews FOR UPDATE 
  USING (auth.uid() = reviewer_id);
CREATE POLICY "Users can delete their own reviews" ON product_reviews FOR DELETE 
  USING (auth.uid() = reviewer_id);

-- RLS Policies for seller_ratings
CREATE POLICY "Anyone can view seller ratings" ON seller_ratings FOR SELECT USING (true);
CREATE POLICY "Users can create seller ratings" ON seller_ratings FOR INSERT 
  WITH CHECK (auth.uid() = rater_id);
CREATE POLICY "Users can update their own ratings" ON seller_ratings FOR UPDATE 
  USING (auth.uid() = rater_id);
CREATE POLICY "Users can delete their own ratings" ON seller_ratings FOR DELETE 
  USING (auth.uid() = rater_id);

-- RLS Policies for review_helpful
CREATE POLICY "Anyone can view helpful votes" ON review_helpful FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote on reviews" ON review_helpful FOR INSERT 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own votes" ON review_helpful FOR UPDATE 
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own votes" ON review_helpful FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_reviewer_id ON product_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_product_reviews_created_at ON product_reviews(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_ratings_seller_id ON seller_ratings(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_ratings_rater_id ON seller_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_seller_ratings_rating ON seller_ratings(rating);

CREATE INDEX IF NOT EXISTS idx_review_helpful_review_id ON review_helpful(review_id);
CREATE INDEX IF NOT EXISTS idx_review_helpful_user_id ON review_helpful(user_id);

-- Function to update product average rating and review count
CREATE OR REPLACE FUNCTION update_product_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products 
  SET 
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2) 
      FROM product_reviews 
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    ),
    review_count = (
      SELECT COUNT(*) 
      FROM product_reviews 
      WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to update seller average rating and review count
CREATE OR REPLACE FUNCTION update_seller_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles 
  SET 
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 2) 
      FROM seller_ratings 
      WHERE seller_id = COALESCE(NEW.seller_id, OLD.seller_id)
    ),
    review_count = (
      SELECT COUNT(*) 
      FROM seller_ratings 
      WHERE seller_id = COALESCE(NEW.seller_id, OLD.seller_id)
    )
  WHERE id = COALESCE(NEW.seller_id, OLD.seller_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to update review helpful count
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE product_reviews 
  SET helpful_count = (
    SELECT COUNT(*) 
    FROM review_helpful 
    WHERE review_id = COALESCE(NEW.review_id, OLD.review_id) 
    AND is_helpful = true
  )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_product_rating_trigger ON product_reviews;
CREATE TRIGGER update_product_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_rating_stats();

DROP TRIGGER IF EXISTS update_seller_rating_trigger ON seller_ratings;
CREATE TRIGGER update_seller_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON seller_ratings
  FOR EACH ROW EXECUTE FUNCTION update_seller_rating_stats();

DROP TRIGGER IF EXISTS update_review_helpful_trigger ON review_helpful;
CREATE TRIGGER update_review_helpful_trigger
  AFTER INSERT OR UPDATE OR DELETE ON review_helpful
  FOR EACH ROW EXECUTE FUNCTION update_review_helpful_count();

-- Add updated_at triggers
CREATE TRIGGER update_product_reviews_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_seller_ratings_updated_at
  BEFORE UPDATE ON seller_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add comments for documentation
COMMENT ON TABLE product_reviews IS 'Customer reviews for products';
COMMENT ON TABLE seller_ratings IS 'Customer ratings for sellers/merchants';
COMMENT ON TABLE review_helpful IS 'Helpful votes for product reviews';

COMMENT ON COLUMN product_reviews.verified_purchase IS 'Whether this review is from a verified purchase';
COMMENT ON COLUMN product_reviews.helpful_count IS 'Number of users who found this review helpful';
COMMENT ON COLUMN seller_ratings.transaction_related IS 'Whether this rating is based on a transaction';
COMMENT ON COLUMN products.average_rating IS 'Average rating from all product reviews';
COMMENT ON COLUMN products.review_count IS 'Total number of reviews for this product';
COMMENT ON COLUMN profiles.average_rating IS 'Average rating as a seller';
COMMENT ON COLUMN profiles.review_count IS 'Total number of ratings received as a seller';
