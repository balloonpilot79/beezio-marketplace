-- Ensure affiliate referral codes and parent tracking on profiles (affiliates)
-- Adjust table name if your "affiliate" records live elsewhere; here we use profiles as the canonical affiliate profile table.

-- 1) Columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID;

-- 2) Foreign key for parent affiliate
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_referred_by_affiliate_fk'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_referred_by_affiliate_fk
      FOREIGN KEY (referred_by_affiliate_id)
      REFERENCES profiles(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 3) Referral code generator (slug + 6 random upper letters/numbers)
CREATE OR REPLACE FUNCTION generate_affiliate_referral_code(p_full_name TEXT, p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  new_code TEXT;
  alphabet CONSTANT TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  attempt INTEGER := 0;
BEGIN
  base_slug := regexp_replace(coalesce(nullif(upper(p_full_name), ''), 'AFFILIATE'), '[^A-Z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN
    base_slug := 'AFFILIATE';
  END IF;

  LOOP
    attempt := attempt + 1;
    SELECT base_slug || '-' ||
           (SELECT string_agg(substr(alphabet, floor(random() * length(alphabet))::int + 1, 1), '')
            FROM generate_series(1, 6))
    INTO new_code;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = new_code);
    EXIT WHEN attempt > 25;
  END LOOP;

  IF attempt > 25 THEN
    new_code := base_slug || '-' || floor(random() * 1e6)::text;
  END IF;

  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger helper to auto-populate when affiliates are inserted/updated without a code
CREATE OR REPLACE FUNCTION set_affiliate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.primary_role = 'affiliate') AND NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_affiliate_referral_code(NEW.full_name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_affiliate_referral_code ON profiles;
CREATE TRIGGER trg_set_affiliate_referral_code
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_affiliate_referral_code();

-- 4) Backfill codes for affiliates
UPDATE profiles
SET referral_code = generate_affiliate_referral_code(full_name, id)
WHERE primary_role = 'affiliate'
  AND referral_code IS NULL;

-- 5) Enforce not-null for affiliate referral codes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_affiliate_referral_code_nn'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_affiliate_referral_code_nn
      CHECK (primary_role <> 'affiliate' OR referral_code IS NOT NULL);
  END IF;
END$$;

-- 6) Unique index (covers all roles, harmless if already present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique ON profiles(referral_code);

-- 7) Helpful index for parent lookups
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_affiliate ON profiles(referred_by_affiliate_id);
