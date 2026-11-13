-- Prepared payments are reservations too. Both manual and automatic paths share these locks.
DROP INDEX IF EXISTS public.uq_payout_items_ledger_payee_active;
CREATE UNIQUE INDEX uq_payout_items_ledger_payee_active
 ON public.payout_items(ledger_id,payee_user_id,payee_role)
 WHERE ledger_id IS NOT NULL AND payee_user_id IS NOT NULL AND payee_role IS NOT NULL
 AND status IN ('PREPARED','CREATED','SENT');
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_items_money_payee_active
 ON public.payout_items(order_money_ledger_id,payee_user_id,payee_role)
 WHERE order_money_ledger_id IS NOT NULL AND status IN ('PREPARED','CREATED','SENT');

CREATE TABLE public.owner_alert_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_key text NOT NULL UNIQUE,
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,
 lease_token uuid,
 last_error text,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_alert_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_alert_outbox FROM anon,authenticated;
GRANT ALL ON public.owner_alert_outbox TO service_role;
CREATE INDEX owner_alert_outbox_pending ON public.owner_alert_outbox(next_attempt_at)
 WHERE status <> 'sent';

CREATE FUNCTION public.claim_owner_alerts(p_limit integer DEFAULT 5)
 RETURNS SETOF public.owner_alert_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN QUERY
 WITH todo AS (
  SELECT id FROM public.owner_alert_outbox
  WHERE status <> 'sent' AND next_attempt_at <= clock_timestamp()
   AND (lease_until IS NULL OR lease_until < clock_timestamp())
  ORDER BY created_at LIMIT least(greatest(p_limit,1),10) FOR UPDATE SKIP LOCKED
 )
 UPDATE public.owner_alert_outbox a
 SET status='sending', attempts=attempts+1, lease_until=clock_timestamp()+interval '2 minutes', lease_token=gen_random_uuid()
 FROM todo WHERE a.id=todo.id RETURNING a.*;
END $$;

-- Every database-created case is captured, even if the HTTP request fails afterward.
CREATE FUNCTION public.queue_owner_dispute_alert() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_dispute public.disputes%rowtype; v_event text; v_key text;
BEGIN
 IF TG_TABLE_NAME='dispute_messages' THEN
  SELECT * INTO v_dispute FROM public.disputes WHERE id=new.dispute_id;
  v_event := 'New dispute message'; v_key := 'dispute-message:'||new.id;
 ELSE
  v_dispute := new;
  IF TG_OP='INSERT' THEN
   v_event := 'Dispute opened'; v_key := 'dispute-opened:'||new.id;
  ELSE
   IF new.status IS NOT DISTINCT FROM old.status AND new.resolution IS NOT DISTINCT FROM old.resolution
      AND new.resolution_type IS NOT DISTINCT FROM old.resolution_type THEN RETURN new; END IF;
   v_event := 'Dispute updated'; v_key := 'dispute-updated:'||new.id||':'||new.updated_at||':'||new.status;
  END IF;
  IF new.order_id IS NOT NULL AND new.status IN ('open','investigating','awaiting_response') THEN
   UPDATE public.orders SET dispute_status='OPEN',updated_at=clock_timestamp() WHERE id=new.order_id;
   UPDATE public.payout_ledger SET status='ON_HOLD_DISPUTE',updated_at=clock_timestamp()
    WHERE order_id=new.order_id AND status IN ('PENDING_HOLD','READY_TO_PAY');
   UPDATE public.payout_snapshots SET status='ON_HOLD_DISPUTE',updated_at=clock_timestamp()
    WHERE order_id=new.order_id AND status IN ('PENDING_HOLD','READY_TO_PAY');
   UPDATE public.order_money_ledger SET status='on_hold_dispute',updated_at=clock_timestamp()
    WHERE order_id=new.order_id AND status IN ('held','ready');
  END IF;
 END IF;
 INSERT INTO public.owner_alert_outbox(event_key,payload)
 VALUES(v_key,jsonb_build_object('title',v_event,'dispute_id',v_dispute.id,'order_id',v_dispute.order_id,
  'status',v_dispute.status,'description',v_dispute.description,'action','Review this dispute. Refund decisions are manual.'))
 ON CONFLICT(event_key) DO NOTHING;
 RETURN new;
END $$;
CREATE TRIGGER owner_alert_dispute AFTER INSERT OR UPDATE ON public.disputes
 FOR EACH ROW EXECUTE FUNCTION public.queue_owner_dispute_alert();
CREATE TRIGGER owner_alert_dispute_message AFTER INSERT ON public.dispute_messages
 FOR EACH ROW EXECUTE FUNCTION public.queue_owner_dispute_alert();

-- Reserve exactly the immutable itemized credits behind the prepared payout amounts.
CREATE FUNCTION public.reserve_normal_payout_credits(p_batch_id uuid) RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i record; v_ids uuid[]; v_total numeric; v_count integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('beezio-normal-payout-reservations'));
 PERFORM 1 FROM public.payout_batches WHERE id=p_batch_id AND status IN ('PREPARED','CREATED') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Batch is not available for reservation'; END IF;
 FOR i IN SELECT pi.*,l.order_id FROM public.payout_items pi JOIN public.payout_ledger l ON l.id=pi.ledger_id
  WHERE pi.payout_batch_id=p_batch_id ORDER BY pi.id FOR UPDATE OF pi LOOP
  SELECT array_agg(c.id),sum(c.net_amount) INTO v_ids,v_total FROM (
   SELECT m.id,m.net_amount FROM public.order_money_ledger m JOIN public.orders o ON o.id=m.order_id
   WHERE m.order_id=i.order_id AND m.payee_id=i.payee_user_id
    AND m.payee_type=CASE i.payee_role::text WHEN 'SELLER' THEN 'seller' WHEN 'PARTNER' THEN 'affiliate' ELSE 'influencer' END
    AND (i.order_money_ledger_id IS NULL OR m.id=i.order_money_ledger_id)
    AND m.status IN ('held','ready') AND m.payout_batch_id IS NULL AND m.net_amount>0 AND m.currency='USD'
    AND m.hold_until IS NOT NULL AND m.hold_until<=clock_timestamp()
    AND o.paid_at IS NOT NULL AND o.paid_at+interval '14 days'<=clock_timestamp()
    AND lower(o.payment_status::text) IN ('paid','completed') AND nullif(o.provider_capture_id,'') IS NOT NULL
    AND coalesce(o.dispute_status::text,'NONE')='NONE'
    AND lower(o.status::text) !~ '(refund|cancel|revers|fail|denied)'
    AND NOT EXISTS(SELECT 1 FROM public.disputes d WHERE d.order_id=o.id AND d.status IN ('open','investigating','awaiting_response'))
   ORDER BY m.id FOR UPDATE OF m
  ) c;
  IF v_ids IS NULL OR v_total<>i.amount THEN RAISE EXCEPTION 'Payout credits changed; rebuild batch'; END IF;
  UPDATE public.order_money_ledger SET payout_batch_id=p_batch_id,status='ready',updated_at=clock_timestamp() WHERE id=ANY(v_ids);
  v_count:=v_count+1;
 END LOOP;
 IF v_count=0 THEN RAISE EXCEPTION 'No payout items reserved'; END IF;
 RETURN v_count;
END $$;

-- Final revalidation and compare-and-set ensure only one worker can submit a batch.
CREATE FUNCTION public.lock_normal_payout_submission(p_batch_id uuid) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.payout_batches%rowtype; i record; v_total numeric; v_today date;
BEGIN
 SELECT * INTO b FROM public.payout_batches WHERE id=p_batch_id FOR UPDATE;
 IF b.id IS NULL OR b.status NOT IN ('PREPARED','CREATED') THEN RAISE EXCEPTION 'Batch is already submitted or requires reconciliation'; END IF;
 v_today:=(clock_timestamp() AT TIME ZONE 'America/Chicago')::date;
 IF b.payout_date<>v_today OR NOT (extract(day from v_today)=15 OR v_today=(date_trunc('month',v_today)+interval '1 month - 1 day')::date) THEN
  RAISE EXCEPTION 'Payouts can only be submitted on their scheduled payday';
 END IF;
 IF EXISTS(SELECT 1 FROM public.payout_items WHERE payout_batch_id=b.id GROUP BY payee_user_id,payee_role HAVING sum(amount)<5) THEN
  RAISE EXCEPTION 'Each payout role must meet the $5 minimum';
 END IF;
 FOR i IN SELECT pi.*,l.order_id,l.hold_release_at,l.status AS ledger_status
  FROM public.payout_items pi JOIN public.payout_ledger l ON l.id=pi.ledger_id
  WHERE pi.payout_batch_id=b.id ORDER BY pi.id FOR UPDATE OF pi,l LOOP
  PERFORM 1 FROM public.orders o WHERE o.id=i.order_id
   AND lower(o.payment_status::text) IN ('paid','completed') AND nullif(o.provider_capture_id,'') IS NOT NULL
   AND o.paid_at IS NOT NULL AND o.paid_at+interval '14 days'<=clock_timestamp()
   AND coalesce(o.dispute_status::text,'NONE')='NONE' AND lower(o.status::text) !~ '(refund|cancel|revers|fail|denied)'
   AND NOT EXISTS(SELECT 1 FROM public.disputes d WHERE d.order_id=o.id AND d.status IN ('open','investigating','awaiting_response'))
   FOR UPDATE;
  IF NOT FOUND OR i.ledger_status<>'READY_TO_PAY' OR i.hold_release_at IS NULL OR i.hold_release_at>clock_timestamp() THEN
   RAISE EXCEPTION 'Order is not eligible for payout'; END IF;
  PERFORM 1 FROM public.paypal_accounts a WHERE a.user_id=i.payee_user_id AND a.role=i.payee_role
   AND a.is_verified=true AND lower(btrim(a.paypal_email))=lower(btrim(i.recipient));
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout account must be connected and verified'; END IF;
  SELECT sum(net_amount) INTO v_total FROM public.order_money_ledger
   WHERE payout_batch_id=b.id AND order_id=i.order_id AND payee_id=i.payee_user_id
   AND payee_type=CASE i.payee_role::text WHEN 'SELLER' THEN 'seller' WHEN 'PARTNER' THEN 'affiliate' ELSE 'influencer' END
   AND status='ready' AND hold_until IS NOT NULL AND hold_until<=clock_timestamp() AND currency='USD';
  IF v_total IS NULL OR v_total<>i.amount OR i.amount<=0 THEN RAISE EXCEPTION 'Reserved payout amount is inconsistent'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.payout_items WHERE payout_batch_id=b.id) THEN RAISE EXCEPTION 'Batch is empty'; END IF;
 UPDATE public.payout_batches SET status='SUBMITTING',updated_at=clock_timestamp() WHERE id=b.id;
 UPDATE public.payout_items SET status='CREATED',updated_at=clock_timestamp() WHERE payout_batch_id=b.id AND status='PREPARED';
 RETURN jsonb_build_object('batch_id',b.id,'payout_date',b.payout_date);
END $$;

CREATE FUNCTION public.fail_normal_payout_batch(p_batch_id uuid,p_expected_status text,p_reason text) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.payout_batches SET status='FAILED',failure_reason=left(p_reason,1000),updated_at=clock_timestamp()
  WHERE id=p_batch_id AND status=p_expected_status;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.payout_items SET status='FAILED',error_message=left(p_reason,1000),updated_at=clock_timestamp()
  WHERE payout_batch_id=p_batch_id AND status IN ('PREPARED','CREATED');
 UPDATE public.order_money_ledger SET payout_batch_id=NULL,updated_at=clock_timestamp()
  WHERE payout_batch_id=p_batch_id AND status IN ('held','ready','on_hold_dispute');
 RETURN true;
END $$;

-- Keep legacy date helpers aligned with the public 15th / month-end schedule.
CREATE OR REPLACE FUNCTION public.next_beezio_payday(p_date date DEFAULT current_date) RETURNS date
 LANGUAGE sql STABLE SET search_path='' AS $$ SELECT CASE WHEN extract(day from p_date)<=15
 THEN (date_trunc('month',p_date)+interval '14 days')::date
 ELSE (date_trunc('month',p_date)+interval '1 month - 1 day')::date END $$;
CREATE OR REPLACE FUNCTION public.next_payout_date_1st_15th(p_date date DEFAULT current_date) RETURNS date
 LANGUAGE sql STABLE SET search_path='' AS $$ SELECT public.next_beezio_payday(p_date) $$;

REVOKE ALL ON FUNCTION public.claim_owner_alerts(integer),public.queue_owner_dispute_alert(),
 public.reserve_normal_payout_credits(uuid),public.lock_normal_payout_submission(uuid),
 public.fail_normal_payout_batch(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_owner_alerts(integer),public.reserve_normal_payout_credits(uuid),
 public.lock_normal_payout_submission(uuid),public.fail_normal_payout_batch(uuid,text,text) TO service_role;


CREATE FUNCTION public.release_normal_payout_holds() RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_count integer;
BEGIN
 UPDATE public.payout_ledger l SET status='READY_TO_PAY',updated_at=clock_timestamp()
 FROM public.orders o WHERE l.order_id=o.id AND l.status='PENDING_HOLD'
 AND l.hold_release_at<=clock_timestamp() AND o.paid_at+interval '14 days'<=clock_timestamp()
 AND lower(o.payment_status::text) IN ('paid','completed') AND nullif(o.provider_capture_id,'') IS NOT NULL
 AND coalesce(o.dispute_status::text,'NONE')='NONE' AND lower(o.status::text) !~ '(refund|cancel|revers|fail|denied)'
 AND NOT EXISTS(SELECT 1 FROM public.disputes d WHERE d.order_id=o.id AND d.status IN ('open','investigating','awaiting_response'));
 GET DIAGNOSTICS v_count=ROW_COUNT;
 UPDATE public.payout_snapshots s SET status='READY_TO_PAY',updated_at=clock_timestamp()
 FROM public.payout_ledger l WHERE s.ledger_id=l.id AND l.status='READY_TO_PAY' AND s.status='PENDING_HOLD';
 UPDATE public.order_money_ledger m SET status='ready',updated_at=clock_timestamp()
 FROM public.orders o,public.payout_ledger l
 WHERE m.order_id=o.id AND l.order_id=o.id AND l.status='READY_TO_PAY' AND m.status='held'
 AND m.hold_until<=clock_timestamp() AND o.paid_at+interval '14 days'<=clock_timestamp()
 AND lower(o.payment_status::text) IN ('paid','completed') AND coalesce(o.dispute_status::text,'NONE')='NONE'
 AND lower(o.status::text) !~ '(refund|cancel|revers|fail|denied)'
 AND NOT EXISTS(SELECT 1 FROM public.disputes d WHERE d.order_id=o.id AND d.status IN ('open','investigating','awaiting_response'));
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.release_normal_payout_holds() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_normal_payout_holds() TO service_role;

CREATE FUNCTION public.expire_unsubmitted_payout_batches() RETURNS integer
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record; n integer:=0;
BEGIN
 FOR b IN SELECT id,status FROM public.payout_batches WHERE status IN ('PREPARED','CREATED')
  AND payout_date<(clock_timestamp() AT TIME ZONE 'America/Chicago')::date FOR UPDATE LOOP
  PERFORM public.fail_normal_payout_batch(b.id,b.status,'Unsubmitted batch expired; eligible credits can be reselected');n:=n+1;
 END LOOP;
 UPDATE public.payout_batches SET status='RECONCILIATION_REQUIRED',failure_reason='Submission worker interrupted; check PayPal before retrying',updated_at=clock_timestamp()
 WHERE status='SUBMITTING' AND updated_at<clock_timestamp()-interval '3 minutes';
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.expire_unsubmitted_payout_batches() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unsubmitted_payout_batches() TO service_role;
