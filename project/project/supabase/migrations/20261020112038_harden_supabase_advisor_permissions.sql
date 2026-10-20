-- Applied atomically through Supabase migrations. No user rows are changed.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';

CREATE TEMP TABLE beezio_advisor_access_baseline (
  actor uuid, db_role text, snapshot jsonb
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.beezio_advisor_snapshot() RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE doc jsonb; table_name text; visible_count bigint; profile_hash text;
BEGIN
 SELECT jsonb_build_object(
   'directory', (SELECT md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id)::text,'[]')) FROM public.profile_directory d),
   'promoter_counts', (SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.product_id)::text,'[]'))
      FROM public.get_product_promoter_counts(ARRAY(SELECT id FROM public.products ORDER BY id LIMIT 10)) c)
 ) INTO doc;
 FOREACH table_name IN ARRAY ARRAY['profiles','orders','order_items','paypal_accounts','user_earnings','payout_ledger'] LOOP
   IF has_table_privilege(current_user,format('public.%I',table_name),'SELECT') THEN
     IF table_name = 'profiles' THEN
       EXECUTE 'SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id)::text,''[]'')) FROM public.profiles p' INTO profile_hash;
       doc := doc || jsonb_build_object(table_name,profile_hash);
     ELSE
       EXECUTE format('SELECT count(*) FROM public.%I',table_name) INTO visible_count;
       doc := doc || jsonb_build_object(table_name,visible_count);
     END IF;
   ELSE
     doc := doc || jsonb_build_object(table_name,'permission denied');
   END IF;
 END LOOP;
 RETURN doc;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.beezio_advisor_snapshot() TO anon, authenticated;

DO $$
DECLARE actor_id uuid; snapshot_doc jsonb;
BEGIN
  FOR actor_id IN SELECT NULL::uuid UNION ALL SELECT user_id FROM (SELECT user_id FROM public.profiles ORDER BY id LIMIT 1) owner_sample
      UNION ALL SELECT '00000000-0000-4000-8000-000000000001'::uuid LOOP
    PERFORM set_config('request.jwt.claim.sub',coalesce(actor_id::text,''),true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role',CASE WHEN actor_id IS NULL THEN 'anon' ELSE 'authenticated' END)::text,true);
    IF actor_id IS NULL THEN SET LOCAL ROLE anon; ELSE SET LOCAL ROLE authenticated; END IF;
    SELECT pg_temp.beezio_advisor_snapshot() INTO snapshot_doc;
    RESET ROLE;
    INSERT INTO beezio_advisor_access_baseline VALUES(actor_id,CASE WHEN actor_id IS NULL THEN 'anon' ELSE 'authenticated' END,snapshot_doc);
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
END $$;

-- Trigger invocation does not require callers to have direct EXECUTE access.
REVOKE ALL ON FUNCTION public.audit_order_money_ledger_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_order_payment_capture() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_payout_ledger_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_order_item_attribution() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonicalize_store_product_owner_id() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.audit_order_money_ledger_insert() SET search_path = '';
ALTER FUNCTION public.audit_order_payment_capture() SET search_path = '';
ALTER FUNCTION public.audit_payout_ledger_payment() SET search_path = '';
ALTER FUNCTION public.backfill_order_item_attribution() SET search_path = '';
ALTER FUNCTION public.canonicalize_store_product_owner_id() SET search_path = '';

-- Both queries already have the ordinary row permissions they need.
ALTER FUNCTION public.beezio_owns_profile(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_product_promoter_counts(uuid[]) SECURITY INVOKER;
ALTER FUNCTION public.get_product_promoter_counts(uuid[]) SET search_path = '';

-- Auth-table and cross-participant lookups genuinely need privilege. Keep these
-- implementations outside the API schema, with explicit, narrow callers.
CREATE SCHEMA beezio_security;
REVOKE ALL ON SCHEMA beezio_security FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA beezio_security TO authenticated, service_role;
ALTER FUNCTION public.beezio_can_read_order(uuid) SET SCHEMA beezio_security;
ALTER FUNCTION public.beezio_email_is_confirmed() SET SCHEMA beezio_security;
REVOKE ALL ON FUNCTION beezio_security.beezio_can_read_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION beezio_security.beezio_email_is_confirmed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION beezio_security.beezio_can_read_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION beezio_security.beezio_email_is_confirmed() TO authenticated, service_role;

CREATE FUNCTION public.beezio_can_read_order(p_order_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT beezio_security.beezio_can_read_order(p_order_id);
$$;
CREATE FUNCTION public.beezio_email_is_confirmed() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT beezio_security.beezio_email_is_confirmed();
$$;
REVOKE ALL ON FUNCTION public.beezio_can_read_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.beezio_email_is_confirmed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.beezio_can_read_order(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.beezio_email_is_confirmed() TO authenticated, service_role;

-- Preserve the directory's FK lineage and private-field masks. Replace its
-- postgres/BYPASSRLS owner with a role that can only read its source columns.
CREATE ROLE beezio_directory_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT beezio_directory_reader TO postgres;
GRANT USAGE ON SCHEMA public TO beezio_directory_reader;
GRANT CREATE ON SCHEMA public TO beezio_directory_reader;
GRANT SELECT (
 id,user_id,email,full_name,role,primary_role,phone,bio,website,location,zip_code,
 avatar_url,created_at,updated_at,average_rating,review_count,store_logo_url,
 store_banner_url,total_earnings,recovery_codes,referral_code,username,subdomain,
 street_address,city,state,country,payment_customer_id,payment_account_id,
 sale_email_notifications,recruited_by_influencer_id,influencer_enabled,payout_email
) ON public.profiles TO beezio_directory_reader;
GRANT EXECUTE ON FUNCTION public.profile_directory_can_read_private(uuid) TO beezio_directory_reader;
CREATE POLICY directory_projection_reader ON public.profiles FOR SELECT
  TO beezio_directory_reader USING (true);
ALTER VIEW public.profile_directory OWNER TO beezio_directory_reader;
REVOKE CREATE ON SCHEMA public FROM beezio_directory_reader;
COMMENT ON VIEW public.profile_directory IS
 'Read-only masked profile directory. Dedicated NOLOGIN NOBYPASSRLS owner has only source-column SELECT and a role-specific RLS policy. Private fields remain visible only to the owner or database-granted administrators. Definer semantics preserve public storefront relationships; do not switch to invoker without separating the public/private profile model.';

-- A real profile owner, anonymous visitors, and an unrelated identity must
-- see exactly the same directory, own profile, financial rows and public counts.
DO $$
DECLARE baseline record; actual jsonb;
BEGIN
  FOR baseline IN SELECT * FROM beezio_advisor_access_baseline LOOP
    PERFORM set_config('request.jwt.claim.sub',coalesce(baseline.actor::text,''),true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',baseline.actor,'role',baseline.db_role)::text,true);
    EXECUTE format('SET LOCAL ROLE %I',baseline.db_role);
    SELECT pg_temp.beezio_advisor_snapshot() INTO actual;
    RESET ROLE;
    IF actual IS DISTINCT FROM baseline.snapshot THEN
      RAISE EXCEPTION 'Access regression for role %, identity %',baseline.db_role,baseline.actor;
    END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='beezio_directory_reader' AND
    (rolcanlogin OR rolbypassrls OR rolsuper OR rolcreaterole OR rolcreatedb)) THEN
    RAISE EXCEPTION 'Directory owner is too privileged';
  END IF;
END $$;
DROP FUNCTION pg_temp.beezio_advisor_snapshot();
NOTIFY pgrst, 'reload schema';

