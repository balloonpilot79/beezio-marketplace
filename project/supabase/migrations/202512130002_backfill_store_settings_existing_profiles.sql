-- Backfill store_settings and subdomains for existing users
--
-- Use cases:
-- - Existing profiles created before auto-store trigger existed
-- - store_settings rows missing (or missing subdomain due to earlier auth/profiles id mismatch)

-- 1) Create store_settings for any profiles missing one
DO $$
DECLARE
  prof RECORD;
  default_store_name text;
  has_full_name boolean;
  has_email boolean;
  profile_full_name text;
  profile_email text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    RAISE NOTICE 'profiles table not found; skipping store backfill';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_settings') THEN
    RAISE NOTICE 'store_settings table not found; skipping store backfill';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) INTO has_full_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) INTO has_email;

  FOR prof IN
    SELECT p.id, p.user_id
    FROM public.profiles p
    LEFT JOIN public.store_settings s ON s.seller_id = p.id
    WHERE s.seller_id IS NULL
  LOOP
    profile_full_name := NULL;
    profile_email := NULL;

    IF has_full_name THEN
      EXECUTE 'SELECT full_name FROM public.profiles WHERE id = $1'
      INTO profile_full_name
      USING prof.id;
    END IF;

    IF has_email THEN
      EXECUTE 'SELECT email FROM public.profiles WHERE id = $1'
      INTO profile_email
      USING prof.id;
    END IF;

    default_store_name := COALESCE(NULLIF(profile_full_name, ''), NULLIF(profile_email, ''), 'My Store');

    INSERT INTO public.store_settings (
      seller_id,
      store_name,
      store_theme,
      subdomain,
      created_at,
      updated_at
    ) VALUES (
      prof.id,
      default_store_name,
      'modern',
      NULL,
      now(),
      now()
    )
    ON CONFLICT (seller_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE '✅ Backfilled missing store_settings rows';
END $$;

-- 2) Backfill store_settings.subdomain sequentially (safe against collisions)
DO $$
DECLARE
  rec RECORD;
  user_email text;
  new_subdomain text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'subdomain') THEN
    RAISE NOTICE 'store_settings.subdomain column not found; skipping subdomain backfill';
    RETURN;
  END IF;

  FOR rec IN
    SELECT s.id AS store_settings_id, p.user_id
    FROM public.store_settings s
    JOIN public.profiles p ON p.id = s.seller_id
    WHERE s.subdomain IS NULL OR s.subdomain = ''
  LOOP
    SELECT email INTO user_email FROM auth.users WHERE id = rec.user_id;

    IF user_email IS NULL OR user_email = '' THEN
      new_subdomain := 'store';
    ELSE
      new_subdomain := public.generate_subdomain_from_email(user_email);
    END IF;

    UPDATE public.store_settings
      SET subdomain = new_subdomain
    WHERE id = rec.store_settings_id
      AND (subdomain IS NULL OR subdomain = '');
  END LOOP;

  RAISE NOTICE '✅ Backfilled store_settings.subdomain';
END $$;

-- 3) Backfill affiliate_store_settings.subdomain sequentially (if table exists)
DO $$
DECLARE
  rec RECORD;
  resolved_user_id uuid;
  user_email text;
  new_subdomain text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_store_settings') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliate_store_settings' AND column_name = 'subdomain') THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT a.id AS affiliate_store_settings_id, a.affiliate_id
    FROM public.affiliate_store_settings a
    WHERE a.subdomain IS NULL OR a.subdomain = ''
  LOOP
    SELECT user_id INTO resolved_user_id FROM public.profiles WHERE id = rec.affiliate_id;
    SELECT email INTO user_email FROM auth.users WHERE id = resolved_user_id;

    IF user_email IS NULL OR user_email = '' THEN
      new_subdomain := 'store';
    ELSE
      new_subdomain := public.generate_subdomain_from_email(user_email);
    END IF;

    UPDATE public.affiliate_store_settings
      SET subdomain = new_subdomain
    WHERE id = rec.affiliate_store_settings_id
      AND (subdomain IS NULL OR subdomain = '');
  END LOOP;

  RAISE NOTICE '✅ Backfilled affiliate_store_settings.subdomain';
END $$;
