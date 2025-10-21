/*
  STORAGE BUCKET SETUP - PRODUCT IMAGES
  
  Run this in Supabase SQL Editor BEFORE uploading products
  
  This creates:
  1. product-images bucket (public read, authenticated write)
  2. user-avatars bucket (for profile pictures)
  3. store-branding bucket (for seller storefronts)
  4. Proper RLS policies for secure access
*/

-- ============================================
-- STEP 1: Create Storage Buckets
-- ============================================

-- Create product-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,  -- Public bucket (anyone can read)
  10485760,  -- 10 MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Create user-avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  5242880,  -- 5 MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create store-branding bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-branding',
  'store-branding',
  true,
  10485760,  -- 10 MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 2: Drop Existing Policies (Clean Slate)
-- ============================================

DROP POLICY IF EXISTS "Anyone can upload to product buckets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read from product buckets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update in product buckets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete from product buckets" ON storage.objects;

DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own product images" ON storage.objects;

DROP POLICY IF EXISTS "Allow uploads to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view product-images" ON storage.objects;

-- ============================================
-- STEP 3: Create New RLS Policies
-- ============================================

-- ⭐ POLICY 1: Public Read (Anyone can view images)
CREATE POLICY "Public read access for product images"
ON storage.objects FOR SELECT
USING (bucket_id IN ('product-images', 'user-avatars', 'store-branding'));

-- ⭐ POLICY 2: Authenticated Upload (Logged-in users can upload)
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id IN ('product-images', 'user-avatars', 'store-branding')
  AND auth.role() = 'authenticated'
);

-- ⭐ POLICY 3: Authenticated Update (Logged-in users can update)
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
USING (
  bucket_id IN ('product-images', 'user-avatars', 'store-branding')
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id IN ('product-images', 'user-avatars', 'store-branding')
  AND auth.role() = 'authenticated'
);

-- ⭐ POLICY 4: Owner Delete (Users can delete their own images)
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
USING (
  bucket_id IN ('product-images', 'user-avatars', 'store-branding')
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- STEP 4: Verification Query
-- ============================================

-- Check if buckets were created successfully
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id IN ('product-images', 'user-avatars', 'store-branding')
ORDER BY created_at DESC;

-- Expected output:
-- | id              | name            | public | file_size_limit | allowed_mime_types          | created_at           |
-- |-----------------|-----------------|--------|-----------------|----------------------------|----------------------|
-- | product-images  | product-images  | true   | 10485760        | {image/jpeg,image/png,...} | 2025-01-20 12:00:00 |
-- | user-avatars    | user-avatars    | true   | 5242880         | {image/jpeg,image/png,...} | 2025-01-20 12:00:00 |
-- | store-branding  | store-branding  | true   | 10485760        | {image/jpeg,image/png,...} | 2025-01-20 12:00:00 |

-- Check if policies were created successfully
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
ORDER BY policyname;

-- Expected output: Should see 4 policies
-- 1. Public read access for product images (SELECT)
-- 2. Authenticated users can upload images (INSERT)
-- 3. Authenticated users can update images (UPDATE)
-- 4. Users can delete their own images (DELETE)

-- ============================================
-- ✅ SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Storage buckets created successfully!';
  RAISE NOTICE '✅ RLS policies configured correctly!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next Steps:';
  RAISE NOTICE '1. Go to Supabase Dashboard → Storage → Buckets';
  RAISE NOTICE '2. Verify you see: product-images, user-avatars, store-branding';
  RAISE NOTICE '3. Click on product-images bucket';
  RAISE NOTICE '4. Upload a test image to verify it works';
  RAISE NOTICE '5. Check the public URL is accessible';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 You are now ready to upload products!';
END $$;
