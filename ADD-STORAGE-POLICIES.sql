-- Storage Policies for Existing Buckets
-- Run this in Supabase SQL Editor

-- ========================================
-- PRODUCT-IMAGES BUCKET POLICIES
-- ========================================
CREATE POLICY "Public read product images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated upload product images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users update own product images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own product images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========================================
-- STORE-BANNERS BUCKET POLICIES
-- ========================================
CREATE POLICY "Public read store banners" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'store-banners');

CREATE POLICY "Authenticated upload store banners" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'store-banners' AND auth.role() = 'authenticated');

CREATE POLICY "Users update own store banners" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own store banners" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========================================
-- PROFILE-AVATARS BUCKET POLICIES
-- ========================================
CREATE POLICY "Public read profile avatars" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'profile-avatars');

CREATE POLICY "Authenticated upload profile avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'profile-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users update own profile avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own profile avatars" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ========================================
-- AVATARS BUCKET POLICIES (if you still use this)
-- ========================================
CREATE POLICY "Public read avatars" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated upload avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users update own avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatars" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- SUCCESS! Storage policies added. Image uploads should now work!
