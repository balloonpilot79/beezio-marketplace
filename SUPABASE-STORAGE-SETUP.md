# Supabase Storage Setup - Image Upload Fix

## Problem
Images won't upload because Supabase Storage buckets don't exist or aren't configured properly.

## Required Storage Buckets

Your app uses these buckets:

1. **`product-images`** - Product photos
2. **`store-images`** - Store banners & logos  
3. **`user-avatars`** - Profile pictures
4. **`store-branding`** - Store customization images

## Step-by-Step Setup

### 1. Go to Supabase Dashboard
- Open https://supabase.com/dashboard
- Select your project
- Click **Storage** in left sidebar

### 2. Create Each Bucket

For **EACH** bucket listed above:

1. Click **"New bucket"**
2. Enter bucket name exactly as shown (e.g., `product-images`)
3. Set **Public bucket:** ✅ **YES** (must be checked)
4. Click **"Create bucket"**

### 3. Set Bucket Policies (IMPORTANT!)

For **EACH** bucket, click on it and go to **Policies** tab:

**Policy 1: Public Read Access**
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
```

**Policy 2: Authenticated Upload**
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);
```

**Policy 3: Users can update own files**
```sql
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

**Policy 4: Users can delete own files**
```sql
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

⚠️ **Replace `'product-images'` with the actual bucket name for each bucket!**

---

## Quick Policy Setup (ALL BUCKETS AT ONCE)

Copy this entire SQL and run in **Supabase SQL Editor**:

```sql
-- Product Images Bucket Policies
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

-- Store Images Bucket Policies
CREATE POLICY "Public read store images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'store-images');

CREATE POLICY "Authenticated upload store images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'store-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users update own store images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'store-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own store images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'store-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- User Avatars Bucket Policies
CREATE POLICY "Public read user avatars" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'user-avatars');

CREATE POLICY "Authenticated upload user avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'user-avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users update own user avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own user avatars" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Store Branding Bucket Policies
CREATE POLICY "Public read store branding" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'store-branding');

CREATE POLICY "Authenticated upload store branding" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'store-branding' AND auth.role() = 'authenticated');

CREATE POLICY "Users update own store branding" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'store-branding' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own store branding" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'store-branding' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

## Verification Checklist

After setup, verify:

- [ ] 4 buckets created: `product-images`, `store-images`, `user-avatars`, `store-branding`
- [ ] All buckets marked as **Public**
- [ ] Each bucket has 4 policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] Test upload in your app - should work immediately

---

## If Upload Still Fails

1. **Check browser console** for specific error messages
2. **Verify Supabase URL** in `project/src/lib/supabase.ts` is correct
3. **Check authentication** - user must be logged in
4. **Try URL input** - ImageUploader has fallback "Enter Image URL" button

---

## Common Errors & Fixes

| Error | Fix |
|-------|-----|
| "Bucket not found" | Create the bucket in Storage |
| "new row violates row-level security" | Add INSERT policy for authenticated users |
| "Permission denied" | Make bucket public OR add SELECT policy |
| "File too large" | Max 10MB - reduce file size |

---

**After running this setup, image uploads should work immediately without any code changes!**
