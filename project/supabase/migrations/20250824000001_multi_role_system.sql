/*
  # Multi-Role User System

  1. New Tables
    - `user_roles`: Track which roles each user has access to
    - Keep existing profiles table but modify role to be primary_role
    
  2. Changes
    - Add user_roles table to track multiple roles per user
    - Update profiles.role to be primary_role (the default dashboard they see)
    - Add functions to manage role switching
    - Update existing policies to work with new role system

  3. Security
    - RLS policies for user_roles table
    - Functions to check user permissions for each role
*/

-- Create user_roles table to track multiple roles per user
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('buyer', 'seller', 'affiliate', 'fundraiser')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure a user can only have one record per role
  UNIQUE(user_id, role)
);

-- Add primary_role column to profiles (keeping role for backwards compatibility)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_role TEXT CHECK (primary_role IN ('buyer', 'seller', 'affiliate', 'fundraiser'));

-- Update existing profiles to set primary_role = role
UPDATE profiles SET primary_role = role WHERE primary_role IS NULL;

-- Make primary_role NOT NULL after updating existing records
ALTER TABLE profiles ALTER COLUMN primary_role SET NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_primary_role ON profiles(primary_role);

-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles table
CREATE POLICY "Users can read own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION user_has_role(user_uuid UUID, role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = user_uuid 
    AND role = role_name 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add a new role to a user
CREATE OR REPLACE FUNCTION add_user_role(user_uuid UUID, role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if role already exists
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = user_uuid AND role = role_name) THEN
    -- Update to active if it exists but is inactive
    UPDATE user_roles 
    SET is_active = true, updated_at = NOW()
    WHERE user_id = user_uuid AND role = role_name;
    RETURN true;
  ELSE
    -- Insert new role
    INSERT INTO user_roles (user_id, role, is_active)
    VALUES (user_uuid, role_name, true);
    RETURN true;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all active roles for a user
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid UUID)
RETURNS TEXT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT role FROM user_roles 
    WHERE user_id = user_uuid AND is_active = true
    ORDER BY created_at ASC
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to switch primary role
CREATE OR REPLACE FUNCTION switch_primary_role(user_uuid UUID, new_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user has access to this role
  IF NOT user_has_role(user_uuid, new_role) THEN
    RETURN false;
  END IF;
  
  -- Update primary role in profiles
  UPDATE profiles 
  SET primary_role = new_role, updated_at = NOW()
  WHERE user_id = user_uuid;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing users to have their current role in user_roles table
INSERT INTO user_roles (user_id, role, is_active, created_at)
SELECT user_id, role, true, created_at
FROM profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Add triggers to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_roles_updated_at 
  BEFORE UPDATE ON user_roles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
