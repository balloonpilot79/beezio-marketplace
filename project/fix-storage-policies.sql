-- FIX STORAGE BUCKET POLICIES FOR IMAGE UPLOADS
-- Run this in your Supabase SQL Editor

-- 1. Fix product-images bucket policies
DROP POLICY IF EXISTS "Users can upload their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create simple, working policies for all buckets
CREATE POLICY "Anyone can upload to product buckets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('product-images', 'user-avatars', 'store-branding'));

CREATE POLICY "Anyone can read from product buckets" ON storage.objects
FOR SELECT TO public
USING (bucket_id IN ('product-images', 'user-avatars', 'store-branding'));

CREATE POLICY "Users can update in product buckets" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id IN ('product-images', 'user-avatars', 'store-branding'))
WITH CHECK (bucket_id IN ('product-images', 'user-avatars', 'store-branding'));

CREATE POLICY "Users can delete from product buckets" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id IN ('product-images', 'user-avatars', 'store-branding'));

-- Ensure buckets exist and are public
INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-images', 'product-images', true),
  ('user-avatars', 'user-avatars', true),
  ('store-branding', 'store-branding', true)
ON CONFLICT (id) DO UPDATE SET public = true;

SELECT 'Storage policies fixed!' as result;