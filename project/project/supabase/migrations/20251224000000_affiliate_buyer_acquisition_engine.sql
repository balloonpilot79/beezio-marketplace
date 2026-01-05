-- Affiliate Buyer Acquisition Engine (Share tools analytics)

CREATE TABLE IF NOT EXISTS public.affiliate_share_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid,
  target_type text NOT NULL,
  target_id text NOT NULL,
  channel text NOT NULL,
  campaign text,
  ts timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aff_share_clicks_affiliate ON public.affiliate_share_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_aff_share_clicks_target ON public.affiliate_share_clicks(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_aff_share_clicks_channel ON public.affiliate_share_clicks(channel);
CREATE INDEX IF NOT EXISTS idx_aff_share_clicks_ts ON public.affiliate_share_clicks(ts);

ALTER TABLE public.affiliate_share_clicks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Allow service_role full access (Netlify + Edge Functions).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'affiliate_share_clicks'
      AND policyname = 'service role can access affiliate share clicks'
  ) THEN
    CREATE POLICY "service role can access affiliate share clicks"
      ON public.affiliate_share_clicks
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

