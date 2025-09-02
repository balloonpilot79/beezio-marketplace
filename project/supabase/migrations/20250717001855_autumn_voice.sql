/*
  # Add videos column to products table

  1. Changes
    - Add `videos` column to `products` table to store video URLs
    - Set default value to empty array
    - Update existing products to have empty videos array

  2. Security
    - No changes to RLS policies needed
    - Videos column follows same access patterns as images
*/

-- Add videos column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS videos text[] DEFAULT '{}';

-- Update existing products to have empty videos array if null
UPDATE products SET videos = '{}' WHERE videos IS NULL;