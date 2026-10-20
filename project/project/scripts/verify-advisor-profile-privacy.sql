SET LOCAL statement_timeout='20s';
CREATE TEMP TABLE beezio_advisor_privacy_results (kind text, result jsonb) ON COMMIT DROP;
DO $$
DECLARE actor_id uuid; actor_admin boolean; expected_confirmed boolean; doc jsonb;
private_columns text[] := ARRAY['email','phone','zip_code','total_earnings','recovery_codes','street_address','city','state','country','payment_customer_id','payment_account_id','sale_email_notifications','recruited_by_influencer_id','payout_email'];
BEGIN
 FOR actor_id IN SELECT NULL::uuid UNION ALL SELECT user_id FROM public.profiles UNION ALL SELECT '00000000-0000-4000-8000-000000000001'::uuid LOOP
  SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=actor_id AND (lower(trim(coalesce(p.role,'')))='admin' OR lower(trim(coalesce(p.primary_role,'')))='admin')) OR EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=actor_id AND r.role='admin' AND r.is_active=true) INTO actor_admin;
  SELECT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=actor_id AND u.email_confirmed_at IS NOT NULL) INTO expected_confirmed;
  PERFORM set_config('request.jwt.claim.sub',coalesce(actor_id::text,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role',CASE WHEN actor_id IS NULL THEN 'anon' ELSE 'authenticated' END)::text,true);
  IF actor_id IS NULL THEN SET LOCAL ROLE anon; ELSE SET LOCAL ROLE authenticated; END IF;
  SELECT jsonb_build_object('admin_authorized',actor_admin,'public_profiles',count(*),
    'other_private_fields',count(*) FILTER (WHERE d.user_id IS DISTINCT FROM auth.uid() AND EXISTS(
      SELECT 1 FROM unnest(private_columns) k WHERE (to_jsonb(d)->k) IS DISTINCT FROM 'null'::jsonb)),
    'own_private_matches',CASE WHEN actor_id IS NULL THEN true ELSE
      coalesce((SELECT bool_and((to_jsonb(own_d)->k) IS NOT DISTINCT FROM (to_jsonb(p)->k))
        FROM public.profile_directory own_d JOIN public.profiles p ON p.id=own_d.id
        CROSS JOIN unnest(private_columns) k WHERE p.user_id=auth.uid()),true) END)
    INTO doc FROM public.profile_directory d;
  IF actor_id IS NOT NULL THEN
    IF public.beezio_email_is_confirmed() IS DISTINCT FROM expected_confirmed THEN RAISE EXCEPTION 'Email confirmation helper regression'; END IF;
    IF public.beezio_owns_profile(actor_id) IS NOT TRUE THEN RAISE EXCEPTION 'Ownership helper regression'; END IF;
    IF public.beezio_can_read_order('00000000-0000-4000-8000-000000000002') IS NOT FALSE THEN RAISE EXCEPTION 'Unknown order not denied'; END IF;
  END IF;
  PERFORM * FROM public.get_product_promoter_counts(ARRAY(SELECT id FROM public.products ORDER BY id LIMIT 10));
  PERFORM d.id FROM public.products p CROSS JOIN LATERAL public.profile_directory(p) d LIMIT 3;
  RESET ROLE;
  IF ((doc->>'other_private_fields')::int<>0 AND NOT actor_admin) OR (doc->>'own_private_matches')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'Profile privacy regression'; END IF;
  INSERT INTO beezio_advisor_privacy_results VALUES(CASE WHEN actor_id IS NULL THEN 'anonymous' ELSE 'authenticated' END,doc);
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
END $$;
SELECT jsonb_build_object('identities_tested',count(*),'all_private_fields_protected',bool_and((result->>'other_private_fields')::int=0 OR (result->>'admin_authorized')::boolean),
 'admin_identities',count(*) FILTER(WHERE (result->>'admin_authorized')::boolean),'all_owner_fields_match',bool_and((result->>'own_private_matches')::boolean),'minimum_public_profiles',min((result->>'public_profiles')::int)) AS verification
FROM beezio_advisor_privacy_results;
