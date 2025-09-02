-- Affiliate Store Customization Table
CREATE TABLE IF NOT EXISTS affiliate_stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT,
  store_description TEXT,
  store_banner TEXT,
  store_logo TEXT,
  store_theme TEXT DEFAULT 'vibrant',
  personal_message TEXT,
  social_links JSONB DEFAULT '{}',
  favorite_categories TEXT[] DEFAULT '{}',
  commission_goal DECIMAL(10,2) DEFAULT 0,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(affiliate_id)
);

-- RLS policies for affiliate_stores
ALTER TABLE affiliate_stores ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own store settings and public view for everyone
CREATE POLICY "Affiliates can view their own store" ON affiliate_stores
  FOR SELECT
  USING (auth.uid() = affiliate_id OR true); -- Allow public read for store display

-- Affiliates can insert their own store settings
CREATE POLICY "Affiliates can create their store" ON affiliate_stores
  FOR INSERT
  WITH CHECK (auth.uid() = affiliate_id);

-- Affiliates can update their own store settings
CREATE POLICY "Affiliates can update their store" ON affiliate_stores
  FOR UPDATE
  USING (auth.uid() = affiliate_id)
  WITH CHECK (auth.uid() = affiliate_id);

-- Affiliates can delete their own store settings
CREATE POLICY "Affiliates can delete their store" ON affiliate_stores
  FOR DELETE
  USING (auth.uid() = affiliate_id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS affiliate_stores_affiliate_id_idx ON affiliate_stores(affiliate_id);
CREATE INDEX IF NOT EXISTS affiliate_stores_created_at_idx ON affiliate_stores(created_at);

-- Sample data for testing
INSERT INTO affiliate_stores (affiliate_id, store_name, store_description, store_theme, personal_message, bio, commission_goal, favorite_categories, social_links) VALUES
  (
    (SELECT id FROM auth.users LIMIT 1), 
    'Tech Enthusiast Store', 
    'Discover the latest and greatest in technology products!',
    'vibrant',
    'Welcome to my tech paradise! I personally test every product I recommend.',
    'I''ve been passionate about technology for over 10 years. I love finding products that make life easier and more enjoyable. Every product in my store has been carefully selected based on quality, value, and innovation.',
    2500.00,
    ARRAY['Electronics', 'Smart Home', 'Fitness Tech', 'Gaming'],
    '{"facebook": "https://facebook.com/techstore", "instagram": "https://instagram.com/techstore", "youtube": "https://youtube.com/techchannel"}'::jsonb
  )
ON CONFLICT (affiliate_id) DO NOTHING;

COMMENT ON TABLE affiliate_stores IS 'Store customization settings for affiliates including themes, branding, and personal information';
