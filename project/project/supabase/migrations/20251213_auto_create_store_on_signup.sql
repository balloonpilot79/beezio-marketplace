-- Auto-create a webstore for every new user
--
-- Goal:
-- - Every time a new profile is created, also create a default seller store row in store_settings
-- - Fix store_settings RLS policies so users can manage their own store_settings row
-- - Fix subdomain auto-generation to correctly resolve auth.users.email via profiles.user_id
--
-- Notes:
-- - store_settings.seller_id references profiles(id)
-- - auth.uid() returns auth.users(id)

-- ------------------------------------------------------------
-- 1) Fix store_settings RLS to use profiles.user_id
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_settings') THEN
    -- Remove the incorrect policies that compare seller_id (profiles.id) to auth.uid() (auth.users.id)
    DROP POLICY IF EXISTS "Sellers can view their own store settings" ON store_settings;
    DROP POLICY IF EXISTS "Sellers can insert their own store settings" ON store_settings;
    DROP POLICY IF EXISTS "Sellers can update their own store settings" ON store_settings;
    DROP POLICY IF EXISTS "Sellers can delete their own store settings" ON store_settings;

    -- Create corrected policies
    CREATE POLICY "Users can view own store settings" ON store_settings
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can insert own store settings" ON store_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own store settings" ON store_settings
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can delete own store settings" ON store_settings
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Keep/ensure public read remains available (some migrations already set this)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_settings') THEN
    -- If the policy already exists, this is a no-op.
    -- If not, create it.
    BEGIN
      CREATE POLICY "Anyone can view store settings for public stores" ON store_settings
        FOR SELECT
        TO public
        USING (true);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2) Fix auto_set_subdomain() to resolve email correctly
-- ------------------------------------------------------------
-- This function is used by triggers on store_settings and affiliate_store_settings.
CREATE OR REPLACE FUNCTION auto_set_subdomain()
RETURNS TRIGGER AS $$
DECLARE
  resolved_user_id uuid;
  user_email text;
BEGIN
  IF NEW.subdomain IS NULL OR NEW.subdomain = '' THEN
    IF TG_TABLE_NAME = 'store_settings' THEN
      SELECT user_id INTO resolved_user_id FROM public.profiles WHERE id = NEW.seller_id;
    ELSIF TG_TABLE_NAME = 'affiliate_store_settings' THEN
      SELECT user_id INTO resolved_user_id FROM public.profiles WHERE id = NEW.affiliate_id;
    END IF;

    IF resolved_user_id IS NOT NULL THEN
      SELECT email INTO user_email FROM auth.users WHERE id = resolved_user_id;
    END IF;

    IF user_email IS NOT NULL THEN
      BEGIN
        NEW.subdomain := public.generate_subdomain_from_email(user_email);
      EXCEPTION
        WHEN undefined_function THEN
          NEW.subdomain := lower(regexp_replace(split_part(user_email, '@', 1), '[^a-z0-9-]', '', 'g'));
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Recreate triggers so they point at the updated function body
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_settings') THEN
    DROP TRIGGER IF EXISTS trigger_auto_subdomain_store ON store_settings;
    CREATE TRIGGER trigger_auto_subdomain_store
      BEFORE INSERT ON store_settings
      FOR EACH ROW
      EXECUTE FUNCTION auto_set_subdomain();
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_store_settings') THEN
    DROP TRIGGER IF EXISTS trigger_auto_subdomain_affiliate ON affiliate_store_settings;
    CREATE TRIGGER trigger_auto_subdomain_affiliate
      BEFORE INSERT ON affiliate_store_settings
      FOR EACH ROW
      EXECUTE FUNCTION auto_set_subdomain();
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) Auto-create default store_settings on profile creation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_default_store_settings_for_new_profile()
RETURNS TRIGGER AS $$
DECLARE
  user_email text;
  proposed_subdomain text;
  proposed_store_name text;
BEGIN
  -- Only run if the table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_settings') THEN
    RETURN NEW;
  END IF;

  -- Store name defaults to the profile full_name (user can change later)
  proposed_store_name := COALESCE(NULLIF(NEW.full_name, ''), 'My Store');

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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    DROP TRIGGER IF EXISTS trigger_create_default_store_settings ON profiles;
    CREATE TRIGGER trigger_create_default_store_settings
      AFTER INSERT ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION create_default_store_settings_for_new_profile();
  END IF;
END $$;
