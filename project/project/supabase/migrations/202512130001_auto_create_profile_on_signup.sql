-- Auto-create profiles on Supabase signup (auth.users insert)
--
-- This makes signup fully automatic at the DB level:
-- auth.users row -> profiles row -> (via trigger in 20251213_auto_create_store_on_signup.sql) store_settings row

CREATE OR REPLACE FUNCTION public.handle_new_user_create_profile()
RETURNS TRIGGER AS $$
DECLARE
  meta_full_name text;
  meta_avatar_url text;
  inferred_name text;
  has_email boolean;
  has_full_name boolean;
  has_avatar_url boolean;
  has_role boolean;
  has_updated_at boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) INTO has_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) INTO has_full_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) INTO has_avatar_url;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) INTO has_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) INTO has_updated_at;

  -- Extract optional metadata
  meta_full_name := NULLIF(NEW.raw_user_meta_data ->> 'full_name', '');
  IF meta_full_name IS NULL THEN
    meta_full_name := NULLIF(NEW.raw_user_meta_data ->> 'name', '');
  END IF;

  meta_avatar_url := NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', '');

  inferred_name := split_part(COALESCE(NEW.email, ''), '@', 1);
  IF inferred_name = '' THEN
    inferred_name := 'User';
  END IF;

  -- Always ensure a profiles row exists.
  -- Many parts of the app assume profiles.id == auth.users.id.
  INSERT INTO public.profiles (id, user_id)
  VALUES (NEW.id, NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update optional columns if they exist
  IF has_email THEN
    EXECUTE 'UPDATE public.profiles SET email = $1 WHERE user_id = $2'
    USING NEW.email, NEW.id;
  END IF;

  IF has_full_name THEN
    EXECUTE 'UPDATE public.profiles SET full_name = $1 WHERE user_id = $2'
    USING COALESCE(meta_full_name, inferred_name), NEW.id;
  END IF;

  IF has_avatar_url THEN
    EXECUTE 'UPDATE public.profiles SET avatar_url = $1 WHERE user_id = $2'
    USING meta_avatar_url, NEW.id;
  END IF;

  IF has_role THEN
    -- Only set a default role if it's NULL
    EXECUTE 'UPDATE public.profiles SET role = COALESCE(role, $1) WHERE user_id = $2'
    USING 'buyer', NEW.id;
  END IF;

  IF has_updated_at THEN
    EXECUTE 'UPDATE public.profiles SET updated_at = now() WHERE user_id = $1'
    USING NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Trigger on auth.users
DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
  CREATE TRIGGER on_auth_user_created_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_create_profile();
END $$;
