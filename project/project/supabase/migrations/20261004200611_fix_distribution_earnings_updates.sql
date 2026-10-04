CREATE OR REPLACE FUNCTION public.update_user_earnings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_record record; v_delta numeric; v_pending numeric; v_paid numeric;
BEGIN
  FOR v_record IN
    SELECT x.* FROM (
      SELECT OLD.recipient_id AS user_id, OLD.recipient_type AS role, OLD.amount AS amount, OLD.status AS status, -1 AS direction WHERE TG_OP IN ('UPDATE','DELETE')
      UNION ALL
      SELECT NEW.recipient_id, NEW.recipient_type, NEW.amount, NEW.status, 1 WHERE TG_OP IN ('INSERT','UPDATE')
    ) x WHERE x.user_id IS NOT NULL AND x.role IN ('seller','affiliate','influencer')
  LOOP
    v_delta := CASE WHEN v_record.status IN ('pending','paid','completed') THEN v_record.amount * v_record.direction ELSE 0 END;
    v_pending := CASE WHEN v_record.status = 'pending' THEN v_record.amount * v_record.direction ELSE 0 END;
    v_paid := CASE WHEN v_record.status IN ('paid','completed') THEN v_record.amount * v_record.direction ELSE 0 END;
    INSERT INTO public.user_earnings(user_id,role,total_earned,pending_payout,paid_out,current_balance)
    VALUES(v_record.user_id,v_record.role,v_delta,v_pending,v_paid,v_pending)
    ON CONFLICT(user_id,role) DO UPDATE SET
      total_earned=public.user_earnings.total_earned+EXCLUDED.total_earned,
      pending_payout=public.user_earnings.pending_payout+EXCLUDED.pending_payout,
      paid_out=public.user_earnings.paid_out+EXCLUDED.paid_out,
      current_balance=public.user_earnings.current_balance+EXCLUDED.current_balance,
      updated_at=now();
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_update_user_earnings ON public.payment_distributions;
CREATE TRIGGER trigger_update_user_earnings AFTER INSERT OR UPDATE OR DELETE ON public.payment_distributions
FOR EACH ROW EXECUTE FUNCTION public.update_user_earnings();

-- Repair any previous inflation from full-amount UPDATE increments.
INSERT INTO public.user_earnings(user_id,role,total_earned,pending_payout,paid_out,current_balance)
SELECT recipient_id,recipient_type,
  coalesce(sum(amount) FILTER(WHERE status IN ('pending','paid','completed')),0),
  coalesce(sum(amount) FILTER(WHERE status='pending'),0),
  coalesce(sum(amount) FILTER(WHERE status IN ('paid','completed')),0),
  coalesce(sum(amount) FILTER(WHERE status='pending'),0)
FROM public.payment_distributions
WHERE recipient_id IS NOT NULL AND recipient_type IN ('seller','affiliate','influencer')
GROUP BY recipient_id,recipient_type
ON CONFLICT(user_id,role) DO UPDATE SET
  total_earned=EXCLUDED.total_earned,pending_payout=EXCLUDED.pending_payout,
  paid_out=EXCLUDED.paid_out,current_balance=EXCLUDED.current_balance,updated_at=now();
