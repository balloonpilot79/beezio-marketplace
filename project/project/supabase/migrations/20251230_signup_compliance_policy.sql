-- Beezio Signup Compliance Policy + acceptance tracking
-- - Stores the policy text/version in DB for display
-- - Records user acceptance for compliance/audit
-- - Backfills existing users (best-effort)
-- - Auto-logs acceptance on signup (auth.users trigger function)
-- Safe to run multiple times.

-- Helper: is admin? (kept here so this migration is self-contained)
-- Note: avoids hard dependency on optional columns like profiles.primary_role.
CREATE OR REPLACE FUNCTION public.is_beezio_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  has_role boolean;
  has_primary_role boolean;
  role_expr text;
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) INTO has_role;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'primary_role'
  ) INTO has_primary_role;

  IF has_role AND has_primary_role THEN
    role_expr := 'lower(coalesce(p.role, p.primary_role, ''''))';
  ELSIF has_role THEN
    role_expr := 'lower(coalesce(p.role, ''''))';
  ELSIF has_primary_role THEN
    role_expr := 'lower(coalesce(p.primary_role, ''''))';
  ELSE
    RETURN false;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.user_id = auth.uid()
         AND %s = ''admin''
     )',
    role_expr
  ) INTO is_admin;

  RETURN is_admin;
END;
$$;

-- ==========================================
-- 1) Legal documents (policy text + version)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.legal_documents (
  document_key text NOT NULL,
  version_date date NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  last_updated date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_key, version_date)
);

ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.legal_documents TO authenticated;

DROP POLICY IF EXISTS "legal_documents_select_public" ON public.legal_documents;
CREATE POLICY "legal_documents_select_public"
ON public.legal_documents
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "legal_documents_admin_manage" ON public.legal_documents;
CREATE POLICY "legal_documents_admin_manage"
ON public.legal_documents
FOR ALL
TO authenticated
USING (public.is_beezio_admin())
WITH CHECK (public.is_beezio_admin());

-- Seed / upsert the policy text
INSERT INTO public.legal_documents (document_key, version_date, title, body, last_updated)
VALUES (
  'beezio_signup_compliance_policy',
  DATE '2025-07-08',
  'Beezio Signup Compliance Policy',
  $policy$
BEEZIO SIGNUP COMPLIANCE POLICY
Last Updated: 2025-07-08

By creating an account on Beezio, you agree to the following terms. These rules apply to all sellers, affiliates, and fundraiser accounts using the Beezio platform.

1. MARKETPLACE ROLE
Beezio is a marketplace platform and is not the seller of goods or services listed on the site. Beezio facilitates payments using Stripe Connect and may collect payments from buyers and distribute funds to sellers, affiliates, referrers, and Beezio according to disclosed fees. Beezio is not responsible for the quality, legality, safety, or fulfillment of seller products.

2. PROHIBITED PRODUCTS AND SERVICES
You may not list, promote, or sell any of the following:
- Illegal goods or services
- Drugs, cannabis, CBD with THC, or drug paraphernalia
- Weapons, firearms, ammunition, or firearm parts
- Adult content, pornography, sexual services, or fetish content, including AI-generated content
- Gambling, lotteries, raffles, sweepstakes, or prize-based contests
- Get-rich-quick schemes, pyramid schemes, or multilevel marketing programs
- Counterfeit goods or products that infringe intellectual property rights
- Fake IDs, identity services, or document falsification services
- Cryptocurrency mining, staking, ICOs, or secondary NFT sales
- Stored value products, wallets, site credits, or gift cards
- Dating or matchmaking services
- Telemedicine, prescription drugs, or regulated medical devices
- Tobacco, vaping, or e-cigarette products
- Debt settlement, credit repair, or debt collection services
- Any product or service prohibited by Stripe or applicable law

Beezio reserves the right to remove listings, suspend accounts, or withhold payouts for violations.

3. COUNTRY AND SANCTIONS COMPLIANCE
You may not use Beezio if you are located in, operate from, or sell to Cuba, Iran, North Korea, Syria, Crimea, Donetsk, Luhansk, or any jurisdiction restricted by U.S., EU, UK, or UN sanctions. You agree not to bypass geographic or sanctions-based restrictions.

4. SELLER RESPONSIBILITIES
Sellers agree that they are legally allowed to sell the products they list and are responsible for fulfillment, shipping, refunds, customer support, and all applicable taxes on their earnings. Beezio may deduct platform fees, refunds, chargebacks, or dispute costs from seller payouts. Sellers must complete Stripe Connect onboarding truthfully and accurately.

5. AFFILIATE PROGRAM RULES
Affiliate earnings are not guaranteed. Commissions may be reversed for refunds, chargebacks, or fraud. Affiliates may not use spam, misleading claims, false testimonials, or represent themselves as employees or agents of Beezio.

6. FUNDRAISERS
Beezio is not a charity. Donations are not tax-deductible. Raffles, lotteries, or prize-based fundraising are not permitted. Funds are distributed to organizers according to disclosed fees, and organizers are responsible for legal compliance.

7. PAYMENTS AND ACCOUNT INTEGRITY
You agree not to use false or misleading information, process payments for undisclosed products or third parties, conduct card testing, engage in fraud, or evade Stripe monitoring or chargeback programs.

8. ENFORCEMENT
Beezio reserves the right to remove listings, suspend or terminate accounts, delay or withhold payouts, and cooperate with Stripe, regulators, or law enforcement as required.

By creating an account, you confirm that you have read, understand, and agree to this policy, Stripe’s prohibited and restricted business rules, and all applicable laws.
$policy$,
  DATE '2025-07-08'
)
ON CONFLICT (document_key, version_date) DO UPDATE
SET title = EXCLUDED.title,
    body = EXCLUDED.body,
    last_updated = EXCLUDED.last_updated;

-- ==========================================
-- 2) Legal acceptances (who agreed + when)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  document_key text NOT NULL,
  version_date date NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  PRIMARY KEY (document_key, version_date, user_id),
  FOREIGN KEY (document_key, version_date)
    REFERENCES public.legal_documents (document_key, version_date)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_time
  ON public.legal_acceptances (user_id, accepted_at DESC);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;

DROP POLICY IF EXISTS "legal_acceptances_select_self_or_admin" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_select_self_or_admin"
ON public.legal_acceptances
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_beezio_admin());

DROP POLICY IF EXISTS "legal_acceptances_insert_self_or_admin" ON public.legal_acceptances;
CREATE POLICY "legal_acceptances_insert_self_or_admin"
ON public.legal_acceptances
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_beezio_admin());

-- Best-effort backfill: existing users are treated as accepted-at-signup (auth.users.created_at)
INSERT INTO public.legal_acceptances (document_key, version_date, user_id, accepted_at)
SELECT 'beezio_signup_compliance_policy', DATE '2025-07-08', u.id, u.created_at
FROM auth.users u
ON CONFLICT (document_key, version_date, user_id) DO NOTHING;

-- ==========================================
-- 3) Auto-log acceptance at signup
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user_create_profile()
RETURNS TRIGGER AS $$
DECLARE
  meta_full_name text;
  meta_avatar_url text;
  inferred_name text;
  has_email boolean;
  has_full_name boolean;
  has_avatar_url boolean;
  has_role boolean;
  has_updated_at boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) INTO has_email;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) INTO has_full_name;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) INTO has_avatar_url;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) INTO has_role;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) INTO has_updated_at;

  -- Extract optional metadata
  meta_full_name := NULLIF(NEW.raw_user_meta_data ->> 'full_name', '');
  IF meta_full_name IS NULL THEN
    meta_full_name := NULLIF(NEW.raw_user_meta_data ->> 'name', '');
  END IF;

  meta_avatar_url := NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', '');

  inferred_name := split_part(COALESCE(NEW.email, ''), '@', 1);
  IF inferred_name = '' THEN
    inferred_name := 'User';
  END IF;

  -- Always ensure a profiles row exists.
  -- Many parts of the app assume profiles.id == auth.users.id.
  INSERT INTO public.profiles (id, user_id)
  VALUES (NEW.id, NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update optional columns if they exist
  IF has_email THEN
    EXECUTE 'UPDATE public.profiles SET email = $1 WHERE user_id = $2'
    USING NEW.email, NEW.id;
  END IF;

  IF has_full_name THEN
    EXECUTE 'UPDATE public.profiles SET full_name = $1 WHERE user_id = $2'
    USING COALESCE(meta_full_name, inferred_name), NEW.id;
  END IF;

  IF has_avatar_url THEN
    EXECUTE 'UPDATE public.profiles SET avatar_url = $1 WHERE user_id = $2'
    USING meta_avatar_url, NEW.id;
  END IF;

  IF has_role THEN
    -- Only set a default role if it's NULL
    EXECUTE 'UPDATE public.profiles SET role = COALESCE(role, $1) WHERE user_id = $2'
    USING 'buyer', NEW.id;
  END IF;

  IF has_updated_at THEN
    EXECUTE 'UPDATE public.profiles SET updated_at = now() WHERE user_id = $1'
    USING NEW.id;
  END IF;

  -- Record signup compliance policy acceptance (best-effort).
  IF to_regclass('public.legal_acceptances') IS NOT NULL THEN
    BEGIN
      INSERT INTO public.legal_acceptances (document_key, version_date, user_id, accepted_at)
      VALUES ('beezio_signup_compliance_policy', DATE '2025-07-08', NEW.id, now())
      ON CONFLICT (document_key, version_date, user_id) DO NOTHING;
    EXCEPTION
      WHEN foreign_key_violation THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Ensure the signup trigger exists and uses the latest function body.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  DROP TRIGGER IF EXISTS on_auth_user_created_create_profile ON auth.users;
  CREATE TRIGGER on_auth_user_created_create_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_create_profile();
END $$;
