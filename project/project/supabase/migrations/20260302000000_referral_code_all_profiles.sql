-- Guarantee every profile has a unique signup/recruit code.
-- Uses deterministic profile-id based code: BZO + uppercase UUID without dashes.

CREATE OR REPLACE FUNCTION public.compute_profile_referral_code(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base_code text;
  candidate text;
  suffix text;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  base_code := 'BZO' || upper(replace(p_profile_id::text, '-', ''));
  candidate := base_code;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.referral_code = candidate
      AND p.id <> p_profile_id
  ) THEN
    LOOP
      suffix := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
      candidate := left(base_code, 46) || suffix;
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.referral_code = candidate
          AND p.id <> p_profile_id
      );
    END LOOP;
  END IF;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(btrim(NEW.referral_code), '') = '' THEN
    NEW.referral_code := public.compute_profile_referral_code(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_referral_code ON public.profiles;

CREATE TRIGGER trg_ensure_profile_referral_code
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_profile_referral_code();

UPDATE public.profiles p
SET referral_code = public.compute_profile_referral_code(p.id)
WHERE coalesce(btrim(p.referral_code), '') = '';
