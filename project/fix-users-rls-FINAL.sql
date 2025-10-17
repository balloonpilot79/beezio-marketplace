-- Fix Users Table RLS Security Issue (CORRECTED - NO is_active column)
-- This version handles cases where is_active column doesn't exist

-- Step 1: Check what columns exist in users table
SELECT 
    column_name, 
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Enable Row Level Security on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop any existing policies (in case they exist)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Public can view basic user info for sellers and affiliates" ON public.users;

-- Step 4: Create policies (simplified - no is_active check)

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
USING (current_role IN ('seller', 'affiliate'));

-- Step 5: Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    CASE 
        WHEN rowsecurity = true THEN '✅ RLS ENABLED'
        ELSE '❌ RLS NOT ENABLED'
    END as status
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

-- Step 7: Count policies
SELECT COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'users' 
AND schemaname = 'public';
