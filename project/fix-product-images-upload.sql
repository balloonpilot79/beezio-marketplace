-- Fix Product Images Upload Policy
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Step 1: Remove any existing conflicting policies
DROP POLICY IF EXISTS "Allow authenticated users to upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Product images upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to product-images" ON storage.objects;

-- Step 2: Create the upload policy for authenticated users
CREATE POLICY "Allow authenticated users to upload product images"
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Step 3: Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname = 'Allow authenticated users to upload product images';
