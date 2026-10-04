-- Keep the existing audit functions, append-only protections, and grants.
-- Add the required event type to the three existing trigger insert statements.
DO $repair$
DECLARE
  item record;
  definition text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('audit_order_payment_capture', 'payment-captured:', 'payment_captured'),
    ('audit_order_money_ledger_insert', 'money-ledger:', 'money_ledger_entry'),
    ('audit_payout_ledger_payment', 'payout-paid:', 'payout_paid')
  ) AS repairs(function_name, event_prefix, event_type)
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO STRICT definition
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=item.function_name AND p.pronargs=0;
    IF position('event_type' in definition)=0 THEN
      IF position('event_key,' in definition)=0 OR position(quote_literal(item.event_prefix) in definition)=0 THEN
        RAISE EXCEPTION 'Unexpected financial audit function structure: %', item.function_name;
      END IF;
      definition := replace(definition, 'event_key,', 'event_type, event_key,');
      definition := replace(definition, quote_literal(item.event_prefix), quote_literal(item.event_type) || ', ' || quote_literal(item.event_prefix));
      EXECUTE definition;
    END IF;
  END LOOP;
END;
$repair$;
