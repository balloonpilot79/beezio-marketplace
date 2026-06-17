-- Restore orders.billing_email for environments that missed the original order migrations.
-- A number of frontend queries, Netlify functions, and Supabase functions read this column.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS billing_email text;

-- Some older environments appear to have used customer_email instead.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'customer_email'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET billing_email = customer_email
      WHERE billing_email IS NULL
        AND customer_email IS NOT NULL
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_billing_email
  ON public.orders (billing_email);
