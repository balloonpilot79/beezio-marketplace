-- Payout hold system (14 days + shipped) for seller payouts
-- Implements separate charges + delayed transfers by holding seller distributions until eligible.

-- 1) Add eligibility metadata to distributions
ALTER TABLE payment_distributions
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS available_at timestamptz,
  ADD COLUMN IF NOT EXISTS hold_reason text;

CREATE INDEX IF NOT EXISTS idx_payment_distributions_status_available_at
  ON payment_distributions(status, available_at);

-- 2) Track held funds separately from withdrawable balance
ALTER TABLE user_earnings
  ADD COLUMN IF NOT EXISTS held_balance decimal(10,2) NOT NULL DEFAULT 0;

-- 3) Replace the earnings trigger to support held -> pending transitions without double counting
CREATE OR REPLACE FUNCTION update_user_earnings()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_user_id uuid;
  v_delta_total decimal(10,2) := 0;
  v_delta_pending decimal(10,2) := 0;
  v_delta_current decimal(10,2) := 0;
  v_delta_held decimal(10,2) := 0;
  old_status text := '';
  new_status text := '';
  old_amt decimal(10,2) := 0;
  new_amt decimal(10,2) := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.recipient_type NOT IN ('seller','affiliate') THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.recipient_id;
  v_role := NEW.recipient_type;
  new_status := COALESCE(NEW.status, '');
  new_amt := COALESCE(NEW.amount, 0);

  IF TG_OP = 'INSERT' THEN
    v_delta_total := new_amt;

    IF new_status = 'held' THEN
      v_delta_held := new_amt;
    ELSIF new_status IN ('pending','available') THEN
      v_delta_pending := new_amt;
      v_delta_current := new_amt;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    old_status := COALESCE(OLD.status, '');
    old_amt := COALESCE(OLD.amount, 0);

    -- Only adjust balances when a distribution moves between buckets.
    IF old_status IS DISTINCT FROM new_status THEN
      -- Remove OLD bucket
      IF old_status = 'held' THEN
        v_delta_held := v_delta_held - old_amt;
      ELSIF old_status IN ('pending','available') THEN
        v_delta_pending := v_delta_pending - old_amt;
        v_delta_current := v_delta_current - old_amt;
      END IF;

      -- Add NEW bucket
      IF new_status = 'held' THEN
        v_delta_held := v_delta_held + new_amt;
      ELSIF new_status IN ('pending','available') THEN
        v_delta_pending := v_delta_pending + new_amt;
        v_delta_current := v_delta_current + new_amt;
      END IF;
    END IF;
  END IF;

  INSERT INTO user_earnings (user_id, role, total_earned, pending_payout, current_balance, held_balance)
  VALUES (v_user_id, v_role, v_delta_total, v_delta_pending, v_delta_current, v_delta_held)
  ON CONFLICT (user_id, role) DO UPDATE SET
    total_earned = user_earnings.total_earned + EXCLUDED.total_earned,
    pending_payout = user_earnings.pending_payout + EXCLUDED.pending_payout,
    current_balance = user_earnings.current_balance + EXCLUDED.current_balance,
    held_balance = COALESCE(user_earnings.held_balance, 0) + EXCLUDED.held_balance,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists (safe)
DROP TRIGGER IF EXISTS trigger_update_user_earnings ON payment_distributions;
CREATE TRIGGER trigger_update_user_earnings
  AFTER INSERT OR UPDATE ON payment_distributions
  FOR EACH ROW EXECUTE FUNCTION update_user_earnings();

