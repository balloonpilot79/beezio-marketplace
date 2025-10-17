-- Fix Users Table RLS Security Issue
-- This enables Row Level Security on the users table and creates appropriate policies

-- Step 1: Enable Row Level Security on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies (in case they exist)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Public can view basic user info for sellers and affiliates" ON public.users;

-- Step 3: Create policy for users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Step 4: Create policy for users to update their own profile
CREATE POLICY "Users can update their own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Step 5: Create policy for users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Step 6: Allow public to view basic info for sellers/affiliates (for store pages, affiliate links, etc.)
-- This only exposes safe, public information
CREATE POLICY "Public can view basic user info for sellers and affiliates"
ON public.users
FOR SELECT
TO public
USING (
  current_role IN ('seller', 'affiliate') 
  AND is_active = true
);

-- Step 7: Optional - Admin policy (if you have admin role)
-- Uncomment if you want admins to see all users
-- CREATE POLICY "Admins can view all users"
-- ON public.users
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM public.users 
--     WHERE id = auth.uid() 
--     AND current_role = 'admin'
--   )
-- );

-- Step 8: Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'users' 
AND schemaname = 'public';

-- Step 9: Verify policies were created
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
WHERE tablename = 'users' 
AND schemaname = 'public'
ORDER BY policyname;
