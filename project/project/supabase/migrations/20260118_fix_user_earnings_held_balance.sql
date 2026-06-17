-- Restore held-balance-aware earnings updates for payout holds and disputes.
-- This replaces the simplified trigger from 20260107 that ignored held/pending transitions.

CREATE OR REPLACE FUNCTION public.update_user_earnings()
RETURNS TRIGGER AS $$
DECLARE
  v_role text;
  v_user_id uuid;
  v_delta_total numeric := 0;
  v_delta_pending numeric := 0;
  v_delta_current numeric := 0;
  v_delta_held numeric := 0;
  old_status text := '';
  new_status text := '';
  old_amt numeric := 0;
  new_amt numeric := 0;
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

    IF old_amt IS DISTINCT FROM new_amt THEN
      v_delta_total := new_amt - old_amt;
    END IF;

    IF old_status IS DISTINCT FROM new_status OR old_amt IS DISTINCT FROM new_amt THEN
      IF old_status = 'held' THEN
        v_delta_held := v_delta_held - old_amt;
      ELSIF old_status IN ('pending','available') THEN
        v_delta_pending := v_delta_pending - old_amt;
        v_delta_current := v_delta_current - old_amt;
      END IF;

      IF new_status = 'held' THEN
        v_delta_held := v_delta_held + new_amt;
      ELSIF new_status IN ('pending','available') THEN
        v_delta_pending := v_delta_pending + new_amt;
        v_delta_current := v_delta_current + new_amt;
      END IF;
    END IF;
  END IF;

  IF v_delta_total = 0 AND v_delta_pending = 0 AND v_delta_current = 0 AND v_delta_held = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_earnings (user_id, role, total_earned, pending_payout, current_balance, held_balance)
  VALUES (v_user_id, v_role, v_delta_total, v_delta_pending, v_delta_current, v_delta_held)
  ON CONFLICT (user_id, role) DO UPDATE SET
    total_earned = public.user_earnings.total_earned + EXCLUDED.total_earned,
    pending_payout = public.user_earnings.pending_payout + EXCLUDED.pending_payout,
    current_balance = public.user_earnings.current_balance + EXCLUDED.current_balance,
    held_balance = COALESCE(public.user_earnings.held_balance, 0) + EXCLUDED.held_balance,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
