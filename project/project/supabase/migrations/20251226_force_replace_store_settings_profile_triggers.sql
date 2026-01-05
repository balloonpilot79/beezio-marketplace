-- Force-replace any profile triggers that touch store_settings, then recreate the default store_settings trigger.
-- Use when legacy triggers/functions still reference non-existent store_settings.user_id.

DO $$
DECLARE
  trig record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    FOR trig IN
      SELECT t.oid, t.tgname
      FROM pg_trigger t
      WHERE t.tgrelid = 'public.profiles'::regclass
        AND NOT t.tgisinternal
        AND pg_get_triggerdef(t.oid) ILIKE '%store_settings%'
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles;', trig.tgname);
    END LOOP;
  END IF;
END $$;

-- Recreate the function + trigger (idempotent).
CREATE OR REPLACE FUNCTION public.create_default_store_settings_for_new_profile()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
  proposed_subdomain text;
  proposed_store_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_settings') THEN
    RETURN NEW;
  END IF;

  proposed_store_name := COALESCE(NULLIF(NEW.full_name, ''), 'My Store');

  BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.user_id;
  EXCEPTION WHEN undefined_table THEN
    user_email := NULL;
  END;

  IF user_email IS NOT NULL THEN
    BEGIN
      proposed_subdomain := public.generate_subdomain_from_email(user_email);
    EXCEPTION
      WHEN undefined_function THEN
        proposed_subdomain := lower(regexp_replace(split_part(user_email, '@', 1), '[^a-z0-9-]', '', 'g'));
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    CREATE TRIGGER trigger_create_default_store_settings
      AFTER INSERT ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.create_default_store_settings_for_new_profile();
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

