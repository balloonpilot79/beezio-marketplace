-- Fix paypal_accounts RLS to match this project's profiles model.
-- In this codebase, profiles.id is NOT auth.uid(); profiles.user_id maps to auth.uid().

DO $$
BEGIN
  -- Ensure RLS is enabled (safe / idempotent)
  BEGIN
    ALTER TABLE public.paypal_accounts ENABLE ROW LEVEL SECURITY;
  EXCEPTION WHEN undefined_table THEN
    -- If table doesn't exist yet, migration ordering issue; ignore.
  END;

  -- Drop the incorrect policy if present
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paypal_accounts'
      AND policyname = 'users manage own paypal accounts'
  ) THEN
    EXECUTE 'DROP POLICY "users manage own paypal accounts" ON public.paypal_accounts';
  END IF;

  -- Recreate policy using profiles.user_id mapping.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'paypal_accounts'
      AND policyname = 'users manage own paypal accounts (by profile)'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "users manage own paypal accounts (by profile)"
        ON public.paypal_accounts
        FOR ALL
        TO authenticated
        USING (
          user_id IN (
            SELECT p.id
            FROM public.profiles p
            WHERE p.user_id = auth.uid()
          )
        )
        WITH CHECK (
          user_id IN (
            SELECT p.id
            FROM public.profiles p
            WHERE p.user_id = auth.uid()
          )
        );
    $pol$;
  END IF;
END $$;
