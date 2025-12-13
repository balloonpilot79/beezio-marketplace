-- Remove personal name from public UI by renaming the profile for jason@beezio.co
-- Run in Supabase SQL Editor (service/admin context).

DO $$
DECLARE
  auth_user_id uuid;
BEGIN
  SELECT id INTO auth_user_id
  FROM auth.users
  WHERE email = 'jason@beezio.co'
  LIMIT 1;

  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row found for email %', 'jason@beezio.co';
  END IF;

  UPDATE profiles
    SET full_name = 'Beezio',
        bio = COALESCE(NULLIF(bio, ''), 'Official Beezio account')
  WHERE user_id = auth_user_id;

  RAISE NOTICE '✅ Updated profiles.full_name to Beezio for user %', auth_user_id;
END $$;
