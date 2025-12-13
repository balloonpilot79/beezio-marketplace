-- Assign the public seller store slug/subdomain "beezio-store" to the account jason@beezio.co
--
-- Run in Supabase SQL Editor (service/admin context). This script:
-- 1) Finds auth.users.id for the email
-- 2) Finds profiles.id for that user
-- 3) Upserts store_settings for that profile with subdomain = 'beezio-store'
-- 4) Clears any existing conflicting store_settings subdomain

DO $$
DECLARE
  auth_user_id uuid;
  profile_id uuid;
BEGIN
  SELECT id INTO auth_user_id
  FROM auth.users
  WHERE email = 'jason@beezio.co'
  LIMIT 1;

  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row found for email %', 'jason@beezio.co';
  END IF;

  SELECT id INTO profile_id
  FROM profiles
  WHERE user_id = auth_user_id
  LIMIT 1;

  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'No profiles row found for auth user id % (email %)', auth_user_id, 'jason@beezio.co';
  END IF;

  -- Ensure store_settings has the subdomain column (created by add_subdomain_support.sql)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'store_settings'
      AND column_name = 'subdomain'
  ) THEN
    RAISE EXCEPTION 'store_settings.subdomain column not found. Run the add_subdomain_support.sql migration first.';
  END IF;

  -- If someone else already owns the beezio-store slug, clear it.
  UPDATE store_settings
    SET subdomain = NULL
  WHERE subdomain = 'beezio-store'
    AND seller_id <> profile_id;

  -- Create/update the store settings for Jason's seller profile.
  INSERT INTO store_settings (
    seller_id,
    store_name,
    store_description,
    store_theme,
    store_logo,
    store_banner,
    business_hours,
    social_links,
    subdomain,
    updated_at
  ) VALUES (
    profile_id,
    'Beezio Store',
    'Official Beezio test store (DB-backed). Use this store to verify product curation, templates, internal messaging, and checkout end-to-end.',
    'modern',
    '/bzobee.png',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80',
    'Open 24/7',
    jsonb_build_object(
      'website', 'https://beezio.co',
      'instagram', 'https://instagram.com/beezio',
      'facebook', 'https://facebook.com/beezio',
      'twitter', 'https://twitter.com/beezio'
    ),
    'beezio-store',
    now()
  )
  ON CONFLICT (seller_id)
  DO UPDATE SET
    store_name = EXCLUDED.store_name,
    store_description = EXCLUDED.store_description,
    store_theme = EXCLUDED.store_theme,
    store_logo = EXCLUDED.store_logo,
    store_banner = EXCLUDED.store_banner,
    business_hours = EXCLUDED.business_hours,
    social_links = EXCLUDED.social_links,
    subdomain = EXCLUDED.subdomain,
    updated_at = now();

  RAISE NOTICE '✅ Beezio seller store configured: /store/beezio-store (seller_id=%, user_id=%)', profile_id, auth_user_id;
END $$;
