-- Update Beezio admin accounts display names and roles
-- Run this in Supabase SQL Editor

-- Update jason@beezio.co account
UPDATE profiles 
SET full_name = 'Beezio',
    role = 'admin'
WHERE email = 'jason@beezio.co';

-- Update jasonlovingsr@gmail.com account as admin
UPDATE profiles 
SET full_name = 'Beezio',
    role = 'admin'
WHERE email = 'jasonlovingsr@gmail.com';

-- Verify the changes
SELECT id, email, full_name, role 
FROM profiles 
WHERE email IN ('jason@beezio.co', 'jasonlovingsr@gmail.com');
