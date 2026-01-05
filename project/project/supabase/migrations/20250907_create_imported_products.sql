-- Migration for imported_products table
CREATE TABLE imported_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  product_data JSONB,
  source TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
