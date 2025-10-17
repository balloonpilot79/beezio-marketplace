-- Fix Users Table RLS Security Issue (CORRECTED FOR BIGINT ID)
-- This version handles cases where user ID is bigint instead of uuid

-- Step 1: First, let's check what type your user ID is
SELECT 
    column_name, 
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
AND column_name = 'id';

-- Step 2: Enable Row Level Security on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing policies (in case they exist)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Public can view basic user info for sellers and affiliates" ON public.users;

-- Step 4: Create policies (CORRECTED for bigint ID type)
-- These policies handle the case where id is bigint

CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
TO authenticated
USING (id::text = auth.uid()::text);

CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id::text = auth.uid()::text)
WITH CHECK (id::text = auth.uid()::text);

CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id::text = auth.uid()::text);

CREATE POLICY "Public can view basic user info for sellers and affiliates"
ON public.users
FOR SELECT
TO public
USING (
  current_role IN ('seller', 'affiliate') 
  AND is_active = true
);

-- Step 5: Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users' 
AND schemaname = 'public';

-- Step 6: Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'users' 
AND schemaname = 'public'
ORDER BY policyname;
