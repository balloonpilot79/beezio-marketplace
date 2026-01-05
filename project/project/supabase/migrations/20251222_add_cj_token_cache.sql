-- Persistent cache for CJ access tokens (helps avoid auth rate limiting on Netlify cold starts)
CREATE TABLE IF NOT EXISTS public.cj_tokens (
  id integer PRIMARY KEY,
  access_token text NOT NULL,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public._set_updated_at_cj_tokens()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_cj_tokens ON public.cj_tokens;
CREATE TRIGGER trg_set_updated_at_cj_tokens
BEFORE UPDATE ON public.cj_tokens
FOR EACH ROW
EXECUTE FUNCTION public._set_updated_at_cj_tokens();

ALTER TABLE public.cj_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies on purpose: only service-role (Netlify Functions) should access this table.
