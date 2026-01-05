-- Align database schema with unified pricing and role spec

-- Extend user_role enum to include new roles if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'user_role' AND e.enumlabel = 'fundraiser') THEN
      ALTER TYPE user_role ADD VALUE 'fundraiser';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'user_role' AND e.enumlabel = 'admin') THEN
      ALTER TYPE user_role ADD VALUE 'admin';
    END IF;
  END IF;
END $$;

-- Ensure the enum changes are committed before reuse in constraints
COMMIT;
BEGIN;

-- Products: seller ask and currency
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seller_ask NUMERIC,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Profiles: track primary role, admin/fundraiser, and who referred the affiliate
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('buyer','seller','affiliate','fundraiser','admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_role TEXT;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_primary_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_primary_role_check CHECK (primary_role IS NULL OR primary_role IN ('buyer','seller','affiliate','fundraiser','admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by_affiliate_id UUID;

-- user_roles: allow admin + fundraiser
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_role_check CHECK (role IN ('buyer','seller','affiliate','fundraiser','admin'));

-- Order items: detailed payout breakdown
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC,
  ADD COLUMN IF NOT EXISTS seller_payout NUMERIC,
  ADD COLUMN IF NOT EXISTS affiliate_commission NUMERIC,
  ADD COLUMN IF NOT EXISTS referral_bonus NUMERIC,
  ADD COLUMN IF NOT EXISTS beezio_gross NUMERIC,
  ADD COLUMN IF NOT EXISTS beezio_net NUMERIC,
  ADD COLUMN IF NOT EXISTS stripe_fee NUMERIC,
  ADD COLUMN IF NOT EXISTS affiliate_id UUID,
  ADD COLUMN IF NOT EXISTS affiliate_referrer_id UUID;
