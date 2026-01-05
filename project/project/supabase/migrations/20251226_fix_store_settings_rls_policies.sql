-- Fix store_settings RLS policies that reference a non-existent store_settings.user_id column.
-- This unblocks automatic store creation (trigger on profiles) and seller store settings upserts.

DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_settings') THEN
    -- Drop all existing policies (some older migrations used incorrect columns).
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'store_settings'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.store_settings;', pol.policyname);
    END LOOP;

    ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

    -- Auth model:
    -- - store_settings.seller_id references profiles(id)
    -- - profiles.user_id references auth.users(id)
    -- Some environments also use profiles.id == auth.uid(); allow both patterns.
    CREATE POLICY "Users can view own store settings" ON public.store_settings
      FOR SELECT
      TO authenticated
      USING (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can insert own store settings" ON public.store_settings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can update own store settings" ON public.store_settings
      FOR UPDATE
      TO authenticated
      USING (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    CREATE POLICY "Users can delete own store settings" ON public.store_settings
      FOR DELETE
      TO authenticated
      USING (
        seller_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = store_settings.seller_id
            AND p.user_id = auth.uid()
        )
      );

    -- Public read for store pages / discovery.
    BEGIN
      CREATE POLICY "Anyone can view store settings for public stores" ON public.store_settings
        FOR SELECT
        TO public
        USING (true);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

