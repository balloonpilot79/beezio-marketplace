-- Emergency clean-up: remove any lingering trigger functions (on public.profiles) that reference
-- a non-existent store_settings.user_id column, then re-create the default store_settings trigger/function.
--
-- Important: only operates on trigger functions attached to public.profiles (avoids touching built-ins).

DO $$
DECLARE
  trig record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    RETURN;
  END IF;

  FOR trig IN
    SELECT
      t.tgname,
      fn_n.nspname AS func_schema,
      fn_p.proname AS func_name,
      pg_get_function_identity_arguments(fn_p.oid) AS func_args,
      pg_get_functiondef(fn_p.oid) AS func_def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace cn ON cn.oid = c.relnamespace
    JOIN pg_proc fn_p ON fn_p.oid = t.tgfoid
    JOIN pg_namespace fn_n ON fn_n.oid = fn_p.pronamespace
    WHERE cn.nspname = 'public'
      AND c.relname = 'profiles'
      AND NOT t.tgisinternal
      AND fn_p.prokind = 'f'
  LOOP
    IF trig.func_def ILIKE '%store_settings%user_id%' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles;', trig.tgname);
      EXECUTE format(
        'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE;',
        trig.func_schema,
        trig.func_name,
        trig.func_args
      );
    END IF;
  END LOOP;
END $$;

-- Recreate the function + trigger (known-good).
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
