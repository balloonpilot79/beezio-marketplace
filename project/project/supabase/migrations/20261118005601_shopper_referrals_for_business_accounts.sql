-- A business account shops with the same login. Freeze its shopping referral
-- at signup just as for shopper-only accounts; never let later metadata edits
-- or checkout links replace an assigned referrer.
CREATE OR REPLACE FUNCTION beezio_private.attach_buyer_referral_from_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE referrer_id uuid;
BEGIN
  BEGIN
    referrer_id := coalesce(
      nullif(new.raw_user_meta_data ->> 'buyer_referrer_profile_id', ''),
      nullif(new.raw_user_meta_data ->> 'referrer_profile_id', '')
    )::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN new;
  END;
  IF referrer_id IS NULL OR referrer_id = new.id THEN RETURN new; END IF;

  INSERT INTO public.influencer_referrals
    (recruited_profile_id, recruited_role, influencer_profile_id, created_at)
  SELECT new.id, 'buyer', p.id, new.created_at
  FROM public.profiles p
  WHERE p.id = referrer_id AND (
    p.role = 'influencer' OR p.primary_role = 'influencer' OR EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = p.user_id AND r.role IN ('influencer', 'buyer') AND r.is_active
    )
  )
  ON CONFLICT (recruited_profile_id, recruited_role) DO NOTHING;
  RETURN new;
END;
$$;
REVOKE ALL ON FUNCTION beezio_private.attach_buyer_referral_from_signup() FROM public, anon, authenticated;

-- Repair only unambiguous, already recorded business referrals. Preserve the
-- original attribution date, so post-purchase referrals cannot earn retroactively.
WITH frozen AS (
  SELECT recruited_profile_id, min(influencer_profile_id::text)::uuid AS referrer_id,
         min(created_at) AS attributed_at
  FROM public.influencer_referrals
  WHERE recruited_role IN ('seller', 'affiliate')
  GROUP BY recruited_profile_id
  HAVING count(DISTINCT influencer_profile_id) = 1
)
INSERT INTO public.influencer_referrals
  (recruited_profile_id, recruited_role, influencer_profile_id, created_at)
SELECT f.recruited_profile_id, 'buyer', f.referrer_id, f.attributed_at
FROM frozen f JOIN public.profiles p ON p.id = f.referrer_id
WHERE f.recruited_profile_id <> f.referrer_id
  AND NOT EXISTS (SELECT 1 FROM public.influencer_referrals r
    WHERE r.recruited_profile_id = f.recruited_profile_id AND r.recruited_role = 'buyer')
  AND (p.role = 'influencer' OR p.primary_role = 'influencer' OR EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p.user_id AND r.role IN ('influencer', 'buyer') AND r.is_active
  ))
ON CONFLICT (recruited_profile_id, recruited_role) DO NOTHING;
