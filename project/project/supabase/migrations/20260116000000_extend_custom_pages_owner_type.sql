DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.custom_pages') IS NULL THEN
    RETURN;
  END IF;

  -- Drop any existing CHECK constraint related to owner_type on custom_pages.
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.custom_pages'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%owner_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.custom_pages DROP CONSTRAINT IF EXISTS %I;', c.conname);
  END LOOP;

  -- Recreate the constraint.
  ALTER TABLE public.custom_pages
    ADD CONSTRAINT custom_pages_owner_type_check
    CHECK (owner_type IN ('seller', 'affiliate'));
END;
$$;
