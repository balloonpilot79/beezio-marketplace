-- Restrict dispute message inserts to participants or admins.
DO $$
BEGIN
  IF to_regclass('public.dispute_messages') IS NULL THEN
    RAISE NOTICE 'Skipping dispute message policy; table does not exist.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "Users can send dispute messages" ON public.dispute_messages';
  EXECUTE $policy$
    CREATE POLICY "Users can send dispute messages"
    ON public.dispute_messages
    FOR INSERT
    WITH CHECK (
      auth.uid() = sender_id
      AND (
        EXISTS (
          SELECT 1
          FROM public.disputes d
          WHERE d.id = dispute_messages.dispute_id
            AND (d.filed_by = auth.uid() OR d.filed_against = auth.uid())
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE (p.id = auth.uid() OR p.user_id = auth.uid())
            AND COALESCE(p.primary_role::text, p.role::text) = 'admin'
        )
      )
    )
  $policy$;
END $$;
