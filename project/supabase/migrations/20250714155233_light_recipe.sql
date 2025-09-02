/*
  # Fix profiles table insert policy

  1. Security
    - Add policy for users to insert their own profile during signup
    - This allows new users to create their profile entry after authentication

  This migration fixes the sign-up issue where users couldn't create their profile
  due to missing INSERT permissions on the profiles table.
*/

-- Add policy to allow users to insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);