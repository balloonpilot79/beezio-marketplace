-- ============================================
-- SUPABASE STORAGE SETUP FOR IMAGE UPLOADS
-- ============================================
-- Run this in Supabase SQL Editor if buckets don't exist

-- Create storage buckets (if they don't exist)
-- Note: You may need to create these in the Supabase UI instead
-- Go to Storage → New bucket

-- Bucket 1: product-images
-- Bucket 2: user-avatars  
-- Bucket 3: store-branding

-- ============================================
-- STORAGE POLICIES (RLS)
-- ============================================

-- Allow authenticated users to upload files
CREATE POLICY IF NOT EXISTS "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('product-images', 'user-avatars', 'store-branding')
);

-- Allow authenticated users to update their own files
CREATE POLICY IF NOT EXISTS "Users can update their own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('product-images', 'user-avatars', 'store-branding') AND
  owner = auth.uid()
);

-- Allow authenticated users to delete their own files
CREATE POLICY IF NOT EXISTS "Users can delete their own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('product-images', 'user-avatars', 'store-branding') AND
  owner = auth.uid()
);

-- Allow everyone to view/download files (public read)
CREATE POLICY IF NOT EXISTS "Public can view all images"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id IN ('product-images', 'user-avatars', 'store-branding')
);

-- ============================================
-- INSTRUCTIONS
-- ============================================

/*
TO SET UP STORAGE BUCKETS:

1. Go to your Supabase project dashboard
2. Click "Storage" in the left sidebar
3. Click "New bucket" button
4. Create these 3 buckets (one at a time):
   
   Bucket 1:
   - Name: product-images
   - Public: YES (check the box)
   - File size limit: 10MB
   - Allowed MIME types: image/jpeg, image/png, image/webp
   
   Bucket 2:
   - Name: user-avatars
   - Public: YES
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/png, image/webp
   
   Bucket 3:
   - Name: store-branding
   - Public: YES
   - File size limit: 10MB
   - Allowed MIME types: image/jpeg, image/png, image/webp

5. After creating buckets, run the SQL above in SQL Editor
   (Go to SQL Editor → New query → Paste → Run)

6. Verify policies are created:
   - Go to Storage → Click each bucket → Policies tab
   - You should see 4 policies for each bucket

DONE! Image uploads should now work.
*/
