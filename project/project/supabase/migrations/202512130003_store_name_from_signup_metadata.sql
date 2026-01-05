-- Use the signup-provided store name (auth metadata) when auto-creating store_settings
--
-- Expects the frontend to pass options.data.store_name during supabase.auth.signUp.

CREATE OR REPLACE FUNCTION public.create_default_store_settings_for_new_profile()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
  proposed_subdomain text;
  proposed_store_name text;
  meta_store_name text;
BEGIN
  -- Only run if the table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_settings') THEN
    RETURN NEW;
  END IF;

  -- Prefer store name from auth signup metadata
  SELECT NULLIF(raw_user_meta_data ->> 'store_name', '')
    INTO meta_store_name
  FROM auth.users
  WHERE id = NEW.user_id;

  IF meta_store_name IS NULL THEN
    -- Accept alternative casing just in case
    SELECT NULLIF(raw_user_meta_data ->> 'storeName', '')
      INTO meta_store_name
    FROM auth.users
    WHERE id = NEW.user_id;
  END IF;

  proposed_store_name := COALESCE(NULLIF(meta_store_name, ''), NULLIF(NEW.full_name, ''), 'My Store');

  -- Try to generate a friendly subdomain from the signup email
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  IF user_email IS NOT NULL THEN
    BEGIN
      proposed_subdomain := public.generate_subdomain_from_email(user_email);
    EXCEPTION
      WHEN undefined_function THEN
        proposed_subdomain := NULL;
    END;
  END IF;

  INSERT INTO public.store_settings (
    seller_id,
    store_name,
    store_description,
    store_theme,
    subdomain,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    proposed_store_name,
    NULL,
    'modern',
    proposed_subdomain,
    now(),
    now()
  )
  ON CONFLICT (seller_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Ensure trigger exists (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    DROP TRIGGER IF EXISTS trigger_create_default_store_settings ON profiles;
    CREATE TRIGGER trigger_create_default_store_settings
      AFTER INSERT ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.create_default_store_settings_for_new_profile();
  END IF;
END $$;
