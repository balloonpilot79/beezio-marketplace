-- Buyer fraud protection, seller dispute thresholds, and driver license verification.

-- =====================================================
-- 1) PROFILES: SELLER ACCOUNT STATUS
-- =====================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seller_account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (seller_account_status IN ('active', 'under_review', 'locked', 'banned')),
  ADD COLUMN IF NOT EXISTS seller_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_lock_reason TEXT,
  ADD COLUMN IF NOT EXISTS seller_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS driver_license_verification_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (driver_license_verification_status IN ('not_submitted', 'submitted', 'under_review', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS driver_license_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_seller_account_status
  ON public.profiles(seller_account_status);

-- =====================================================
-- 2) BUYER PROTECTION CASES (FRAUD PROTECTION)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.buyer_protection_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  case_type TEXT NOT NULL DEFAULT 'fraud'
    CHECK (case_type IN ('fraud', 'item_not_received', 'item_not_as_described', 'chargeback', 'other')),
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'awaiting_buyer', 'awaiting_seller', 'resolved', 'denied')),
  resolution TEXT,
  refund_amount NUMERIC(10,2),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_protection_cases_buyer
  ON public.buyer_protection_cases(buyer_id);

CREATE INDEX IF NOT EXISTS idx_buyer_protection_cases_seller
  ON public.buyer_protection_cases(seller_id);

CREATE INDEX IF NOT EXISTS idx_buyer_protection_cases_status
  ON public.buyer_protection_cases(status);

DROP TRIGGER IF EXISTS update_buyer_protection_timestamp ON public.buyer_protection_cases;
CREATE TRIGGER update_buyer_protection_timestamp
  BEFORE UPDATE ON public.buyer_protection_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_moderation_updated_at();

ALTER TABLE public.buyer_protection_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buyers can create protection cases" ON public.buyer_protection_cases;
CREATE POLICY "buyers can create protection cases"
  ON public.buyer_protection_cases
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "buyers can view own protection cases" ON public.buyer_protection_cases;
CREATE POLICY "buyers can view own protection cases"
  ON public.buyer_protection_cases
  FOR SELECT USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "sellers can view protection cases against them" ON public.buyer_protection_cases;
CREATE POLICY "sellers can view protection cases against them"
  ON public.buyer_protection_cases
  FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "admins manage protection cases" ON public.buyer_protection_cases;
CREATE POLICY "admins manage protection cases"
  ON public.buyer_protection_cases
  FOR ALL USING (public.is_beezio_admin_safe())
  WITH CHECK (public.is_beezio_admin_safe());

COMMENT ON TABLE public.buyer_protection_cases IS 'Buyer fraud protection and buyer protection case management.';

-- =====================================================
-- 3) SELLER REINSTATEMENT REQUESTS (APPEAL / REMEDIATION PLAN)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.seller_reinstatement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('appeal', 'remediation_plan')),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seller_reinstatement_requests_seller
  ON public.seller_reinstatement_requests(seller_id);

CREATE INDEX IF NOT EXISTS idx_seller_reinstatement_requests_status
  ON public.seller_reinstatement_requests(status);

DROP TRIGGER IF EXISTS update_seller_reinstatement_timestamp ON public.seller_reinstatement_requests;
CREATE TRIGGER update_seller_reinstatement_timestamp
  BEFORE UPDATE ON public.seller_reinstatement_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_moderation_updated_at();

ALTER TABLE public.seller_reinstatement_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sellers can submit reinstatement requests" ON public.seller_reinstatement_requests;
CREATE POLICY "sellers can submit reinstatement requests"
  ON public.seller_reinstatement_requests
  FOR INSERT WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "sellers can view own reinstatement requests" ON public.seller_reinstatement_requests;
CREATE POLICY "sellers can view own reinstatement requests"
  ON public.seller_reinstatement_requests
  FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "admins manage reinstatement requests" ON public.seller_reinstatement_requests;
CREATE POLICY "admins manage reinstatement requests"
  ON public.seller_reinstatement_requests
  FOR ALL USING (public.is_beezio_admin_safe())
  WITH CHECK (public.is_beezio_admin_safe());

COMMENT ON TABLE public.seller_reinstatement_requests IS 'Appeals or remediation plans required to reinstate sellers.';

-- =====================================================
-- 4) DRIVER LICENSE VERIFICATION
-- =====================================================
CREATE TABLE IF NOT EXISTS public.driver_license_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'verified', 'rejected')),
  document_urls TEXT[] NOT NULL,
  issuing_country TEXT,
  issuing_region TEXT,
  expiration_date DATE,
  license_last4 TEXT,
  reviewer_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_license_verifications_user
  ON public.driver_license_verifications(user_id);

CREATE INDEX IF NOT EXISTS idx_driver_license_verifications_status
  ON public.driver_license_verifications(status);

DROP TRIGGER IF EXISTS update_driver_license_verifications_timestamp ON public.driver_license_verifications;
CREATE TRIGGER update_driver_license_verifications_timestamp
  BEFORE UPDATE ON public.driver_license_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_moderation_updated_at();

CREATE OR REPLACE FUNCTION public.sync_driver_license_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET driver_license_verification_status = NEW.status,
      driver_license_verified_at = CASE WHEN NEW.status = 'verified' THEN COALESCE(NEW.verified_at, NOW()) ELSE NULL END
  WHERE user_id = NEW.user_id OR id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_driver_license_status ON public.driver_license_verifications;
CREATE TRIGGER sync_driver_license_status
  AFTER INSERT OR UPDATE ON public.driver_license_verifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_driver_license_status();

ALTER TABLE public.driver_license_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can submit driver license verification" ON public.driver_license_verifications;
CREATE POLICY "users can submit driver license verification"
  ON public.driver_license_verifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users can view own driver license verification" ON public.driver_license_verifications;
CREATE POLICY "users can view own driver license verification"
  ON public.driver_license_verifications
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins manage driver license verification" ON public.driver_license_verifications;
CREATE POLICY "admins manage driver license verification"
  ON public.driver_license_verifications
  FOR ALL USING (public.is_beezio_admin_safe())
  WITH CHECK (public.is_beezio_admin_safe());

COMMENT ON TABLE public.driver_license_verifications IS 'Driver license verification submissions (manual review).';

-- =====================================================
-- 5) DISPUTE THRESHOLD ENFORCEMENT (3 IN 180 DAYS -> REVIEW, 4 -> BAN)
-- =====================================================
CREATE OR REPLACE FUNCTION public.apply_seller_dispute_policy()
RETURNS TRIGGER AS $$
DECLARE
  dispute_count INTEGER;
  now_ts TIMESTAMPTZ := NOW();
  already_banned BOOLEAN;
  already_under_review BOOLEAN;
BEGIN
  IF NEW.filed_against IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO dispute_count
  FROM public.disputes d
  WHERE d.filed_against = NEW.filed_against
    AND d.created_at >= (now_ts - INTERVAL '180 days');

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.user_id = NEW.filed_against OR p.id = NEW.filed_against)
      AND p.seller_account_status = 'banned'
  ) INTO already_banned;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.user_id = NEW.filed_against OR p.id = NEW.filed_against)
      AND p.seller_account_status = 'under_review'
  ) INTO already_under_review;

  IF dispute_count >= 4 THEN
    IF NOT already_banned THEN
      UPDATE public.profiles
      SET seller_account_status = 'banned',
          seller_banned_at = now_ts,
          seller_locked_at = COALESCE(seller_locked_at, now_ts),
          seller_lock_reason = '4+ disputes in 180 days; selling disabled until case-by-case review'
      WHERE user_id = NEW.filed_against OR id = NEW.filed_against;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.user_moderation um
      WHERE um.user_id = NEW.filed_against
        AND um.is_active = true
        AND um.action_type = 'ban'
    ) THEN
      INSERT INTO public.user_moderation (
        user_id,
        action_type,
        reason,
        restrictions,
        is_active,
        applied_by,
        notes
      )
      VALUES (
        NEW.filed_against,
        'ban',
        'Dispute threshold reached (4+ in 180 days)',
        jsonb_build_object('cannot_sell', true, 'case_by_case_review', true),
        true,
        NEW.filed_by,
        'Auto-ban from dispute policy'
      );
    END IF;
  ELSIF dispute_count >= 3 THEN
    IF NOT already_banned AND NOT already_under_review THEN
      UPDATE public.profiles
      SET seller_account_status = 'under_review',
          seller_locked_at = COALESCE(seller_locked_at, now_ts),
          seller_lock_reason = '3 disputes in 180 days; account locked pending review'
      WHERE user_id = NEW.filed_against OR id = NEW.filed_against;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.user_moderation um
      WHERE um.user_id = NEW.filed_against
        AND um.is_active = true
        AND um.action_type = 'restriction'
        AND um.reason = 'Dispute threshold reached (3 in 180 days)'
    ) THEN
      INSERT INTO public.user_moderation (
        user_id,
        action_type,
        reason,
        restrictions,
        is_active,
        applied_by,
        notes
      )
      VALUES (
        NEW.filed_against,
        'restriction',
        'Dispute threshold reached (3 in 180 days)',
        jsonb_build_object('cannot_sell', true, 'under_review', true),
        true,
        NEW.filed_by,
        'Auto-lock from dispute policy'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_seller_dispute_policy ON public.disputes;
CREATE TRIGGER apply_seller_dispute_policy
  AFTER INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.apply_seller_dispute_policy();

-- Restrictive policy: block locked/banned sellers from updating products.
CREATE OR REPLACE FUNCTION public.is_seller_blocked(p_seller_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  blocked BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE (p.user_id = p_seller_id OR p.id = p_seller_id)
      AND p.seller_account_status IN ('under_review', 'locked', 'banned')
  ) INTO blocked;

  RETURN blocked;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "products_restrict_blocked_sellers" ON public.products';
    EXECUTE $pol$
      CREATE POLICY "products_restrict_blocked_sellers"
      ON public.products
      AS RESTRICTIVE
      FOR UPDATE
      USING (
        NOT public.is_seller_blocked(seller_id)
        OR public.is_beezio_admin_safe()
      )
      WITH CHECK (
        NOT public.is_seller_blocked(seller_id)
        OR public.is_beezio_admin_safe()
      )
    $pol$;
  END IF;
END $$;
