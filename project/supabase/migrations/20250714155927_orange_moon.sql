/*
  # Fix profiles table policies for authentication

  1. Security
    - Drop existing policies that might be conflicting
    - Add comprehensive policies for profiles table
    - Ensure users can insert, read, and update their own profiles
    - Allow public read access for basic profile information

  2. Changes
    - Add policy for users to insert their own profile during signup
    - Add policy for users to read their own profile
    - Add policy for users to update their own profile
    - Add policy for public read access to basic profile info
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can read public profiles" ON profiles;

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy for users to insert their own profile during signup
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for public read access to basic profile information (for product listings, etc.)
CREATE POLICY "Public can read basic profile info"
  ON profiles
  FOR SELECT
  TO public
  USING (true);