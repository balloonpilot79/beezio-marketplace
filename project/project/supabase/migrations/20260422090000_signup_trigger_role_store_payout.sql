-- Make auth signup self-contained so browser signup does not need to insert
-- into public.profiles. This avoids RLS failures when email confirmation means
-- there is no authenticated browser session immediately after signUp().

CREATE OR REPLACE FUNCTION public.handle_new_user_create_profile()
RETURNS TRIGGER AS $$
DECLARE
  meta_full_name text;
  meta_avatar_url text;
  inferred_name text;
  requested_role text;
  requested_store_name text;
  requested_store_slug text;
  requested_paypal_email text;
  paypal_confirmed boolean;
  has_email boolean;
  has_full_name boolean;
  has_avatar_url boolean;
  has_role boolean;
  has_primary_role boolean;
  has_phone boolean;
  has_location boolean;
  has_zip_code boolean;
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
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'primary_role'
  ) INTO has_primary_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) INTO has_phone;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location'
  ) INTO has_location;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'zip_code'
  ) INTO has_zip_code;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) INTO has_updated_at;

  meta_full_name := NULLIF(NEW.raw_user_meta_data ->> 'full_name', '');
  IF meta_full_name IS NULL THEN
    meta_full_name := NULLIF(NEW.raw_user_meta_data ->> 'name', '');
  END IF;

  meta_avatar_url := NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', '');
  requested_role := lower(NULLIF(NEW.raw_user_meta_data ->> 'role', ''));
  IF requested_role NOT IN ('buyer', 'seller', 'affiliate', 'fundraiser') THEN
    requested_role := 'buyer';
  END IF;

  requested_store_name := NULLIF(NEW.raw_user_meta_data ->> 'store_name', '');
  requested_store_slug := lower(NULLIF(NEW.raw_user_meta_data ->> 'store_slug', ''));
  requested_paypal_email := NULLIF(NEW.raw_user_meta_data ->> 'paypal_email', '');
  paypal_confirmed := lower(coalesce(NEW.raw_user_meta_data ->> 'paypal_confirmed', 'false')) IN ('true', '1', 'yes');

  inferred_name := split_part(COALESCE(NEW.email, ''), '@', 1);
  IF inferred_name = '' THEN
    inferred_name := 'User';
  END IF;

  IF requested_store_name IS NULL THEN
    requested_store_name := COALESCE(meta_full_name, inferred_name, 'My Store');
  END IF;

  IF requested_store_slug IS NULL OR requested_store_slug = '' THEN
    BEGIN
      requested_store_slug := public.generate_subdomain_from_email(NEW.email);
    EXCEPTION
      WHEN undefined_function THEN
        requested_store_slug := lower(regexp_replace(split_part(COALESCE(NEW.email, ''), '@', 1), '[^a-z0-9-]', '', 'g'));
    END;
  END IF;

  -- Avoid aborting auth signup on a duplicate store slug.
  IF requested_store_slug IS NOT NULL AND requested_store_slug <> '' THEN
    IF (
      to_regclass('public.store_settings') IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.store_settings WHERE subdomain = requested_store_slug AND seller_id <> NEW.id)
    ) OR (
      to_regclass('public.affiliate_store_settings') IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.affiliate_store_settings WHERE subdomain = requested_store_slug AND affiliate_id <> NEW.id)
    ) THEN
      requested_store_slug := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, user_id)
  VALUES (NEW.id, NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

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
    EXECUTE 'UPDATE public.profiles SET role = $1 WHERE user_id = $2'
    USING requested_role, NEW.id;
  END IF;

  IF has_primary_role THEN
    EXECUTE 'UPDATE public.profiles SET primary_role = $1 WHERE user_id = $2'
    USING requested_role, NEW.id;
  END IF;

  IF has_phone THEN
    EXECUTE 'UPDATE public.profiles SET phone = $1 WHERE user_id = $2'
    USING NULLIF(NEW.raw_user_meta_data ->> 'phone', ''), NEW.id;
  END IF;

  IF has_location THEN
    EXECUTE 'UPDATE public.profiles SET location = $1 WHERE user_id = $2'
    USING NULLIF(trim(concat_ws(', ', NULLIF(NEW.raw_user_meta_data ->> 'city', ''), NULLIF(NEW.raw_user_meta_data ->> 'state', ''))), ''), NEW.id;
  END IF;

  IF has_zip_code THEN
    EXECUTE 'UPDATE public.profiles SET zip_code = $1 WHERE user_id = $2'
    USING NULLIF(NEW.raw_user_meta_data ->> 'zip_code', ''), NEW.id;
  END IF;

  IF has_updated_at THEN
    EXECUTE 'UPDATE public.profiles SET updated_at = now() WHERE user_id = $1'
    USING NEW.id;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role, is_active)
      VALUES (NEW.id, requested_role, true)
      ON CONFLICT DO NOTHING;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_column THEN NULL;
    END;
  END IF;

  IF requested_role = 'seller' AND to_regclass('public.store_settings') IS NOT NULL THEN
    INSERT INTO public.store_settings (seller_id, store_name, subdomain, store_theme, created_at, updated_at)
    VALUES (NEW.id, requested_store_name, requested_store_slug, 'modern', now(), now())
    ON CONFLICT (seller_id) DO UPDATE
      SET store_name = COALESCE(public.store_settings.store_name, EXCLUDED.store_name),
          subdomain = COALESCE(public.store_settings.subdomain, EXCLUDED.subdomain),
          updated_at = now();
  END IF;

  IF requested_role = 'affiliate' AND to_regclass('public.affiliate_store_settings') IS NOT NULL THEN
    INSERT INTO public.affiliate_store_settings (affiliate_id, store_name, subdomain, is_active, created_at, updated_at)
    VALUES (NEW.id, requested_store_name, requested_store_slug, true, now(), now())
    ON CONFLICT (affiliate_id) DO UPDATE
      SET store_name = COALESCE(public.affiliate_store_settings.store_name, EXCLUDED.store_name),
          subdomain = COALESCE(public.affiliate_store_settings.subdomain, EXCLUDED.subdomain),
          is_active = COALESCE(public.affiliate_store_settings.is_active, true),
          updated_at = now();
  END IF;

  IF requested_role IN ('seller', 'affiliate')
     AND paypal_confirmed
     AND requested_paypal_email IS NOT NULL
     AND to_regclass('public.paypal_accounts') IS NOT NULL THEN
    INSERT INTO public.paypal_accounts (user_id, role, paypal_email, is_verified)
    VALUES
      (NEW.id, 'SELLER', requested_paypal_email, false),
      (NEW.id, 'PARTNER', requested_paypal_email, false),
      (NEW.id, 'INFLUENCER', requested_paypal_email, false)
    ON CONFLICT (user_id, role) DO UPDATE
      SET paypal_email = EXCLUDED.paypal_email,
          updated_at = now();
  END IF;

  IF to_regclass('public.legal_acceptances') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.legal_acceptances (document_key, version_date, user_id, accepted_at)
      VALUES ('beezio_signup_compliance_policy', DATE '2025-07-08', NEW.id, now())
      ON CONFLICT (document_key, version_date, user_id) DO NOTHING;
    EXCEPTION
      WHEN foreign_key_violation THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
  CREATE TRIGGER on_auth_user_created_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_create_profile();
END $$;
