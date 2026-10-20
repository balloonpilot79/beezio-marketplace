-- Explicitly approved by Jason on 2026-10-20 after review of the 76-policy scope.
-- Authorization expressions are unchanged except for caching request-scoped auth calls.
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='45s';
CREATE TEMP TABLE beezio_rls_before (actor uuid, db_role text, snapshot jsonb) ON COMMIT DROP;
CREATE TEMP TABLE beezio_policy_before ON COMMIT DROP AS
 SELECT schemaname,tablename,policyname,cmd,roles,permissive FROM pg_policies WHERE schemaname='public';
CREATE FUNCTION pg_temp.beezio_rls_snapshot(table_names text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $snapshot$
DECLARE table_name text; doc jsonb := '{}'::jsonb; rows_hash text; row_count bigint;
BEGIN
 FOREACH table_name IN ARRAY table_names LOOP
  IF has_table_privilege(current_user,format('public.%I',table_name),'SELECT') THEN
   BEGIN
    EXECUTE format('SELECT count(*), md5(coalesce(jsonb_agg(row_doc ORDER BY row_doc::text)::text,''[]'')) FROM (SELECT to_jsonb(t) AS row_doc FROM public.%I t) q',table_name)
     INTO row_count,rows_hash;
    doc := doc || jsonb_build_object(table_name,jsonb_build_object('rows',row_count,'hash',rows_hash));
   EXCEPTION WHEN OTHERS THEN
    doc := doc || jsonb_build_object(table_name,jsonb_build_object('error',SQLSTATE));
   END;
  ELSE
   doc := doc || jsonb_build_object(table_name,jsonb_build_object('access','denied'));
  END IF;
 END LOOP;
 RETURN doc;
END;
$snapshot$;
GRANT EXECUTE ON FUNCTION pg_temp.beezio_rls_snapshot(text[]) TO anon,authenticated;
DO $baseline$
DECLARE actor_id uuid; snapshot_doc jsonb;
BEGIN
 FOR actor_id IN SELECT NULL::uuid UNION ALL SELECT user_id FROM public.profiles
 UNION ALL SELECT '00000000-0000-4000-8000-000000000001'::uuid LOOP
  PERFORM set_config('request.jwt.claim.sub',coalesce(actor_id::text,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role',CASE WHEN actor_id IS NULL THEN 'anon' ELSE 'authenticated' END)::text,true);
  IF actor_id IS NULL THEN SET LOCAL ROLE anon; ELSE SET LOCAL ROLE authenticated; END IF;
  SELECT pg_temp.beezio_rls_snapshot(ARRAY['affiliate_stats','affiliate_store_products','affiliate_store_settings','affiliate_stores','audit_log','category_map_cj_to_beezio','chat_logs','cj_products','custom_pages','customer_subscriptions','delivery_tracking','dispute_messages','disputes','imported_products','moderation_log','order_items','order_money_ledger','orders','payment_distributions','payout_batch_items','payout_items','payout_ledger','payout_snapshots','paypal_accounts','pricing_rules','product_images','product_variants','products','profile_directory','profiles','referral_commissions','referrals','reported_content','review_helpful','seller_ratings','seller_verification','shipping_labels','shipping_rules','store_settings','store_visits','subscription_billings','sync_history','transactions','user_badges','user_integrations','user_moderation','user_roles','vendor_orders','vendors']::text[]) INTO snapshot_doc;
  RESET ROLE;
  INSERT INTO beezio_rls_before VALUES(actor_id,CASE WHEN actor_id IS NULL THEN 'anon' ELSE 'authenticated' END,snapshot_doc);
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
END $baseline$;
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='Users can insert their own orders' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(auth.uid() = user_id)') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can insert their own orders" ON "public"."orders" WITH CHECK (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='Users can view their own orders' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = user_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own orders" ON "public"."orders" USING (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can read own roles' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = user_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can read own roles" ON "public"."user_roles" USING (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can read own profile' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = user_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can read own profile" ON "public"."profiles" USING (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='affiliate_stores' AND policyname='Users can manage own stores' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = auth.uid())))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can manage own stores" ON "public"."affiliate_stores" USING ((profile_id IN ( SELECT profiles.id
   FROM profiles
  WHERE (profiles.user_id = (select auth.uid())))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='affiliate_store_products' AND policyname='Store owners can manage store products' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(store_id IN ( SELECT affiliate_stores.id
   FROM affiliate_stores
  WHERE (affiliate_stores.profile_id IN ( SELECT profiles.id
           FROM profiles
          WHERE (profiles.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Store owners can manage store products" ON "public"."affiliate_store_products" USING ((store_id IN ( SELECT affiliate_stores.id
   FROM affiliate_stores
  WHERE (affiliate_stores.profile_id IN ( SELECT profiles.id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_visits' AND policyname='Store owners can view own store visits' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(store_id IN ( SELECT affiliate_stores.id
   FROM affiliate_stores
  WHERE (affiliate_stores.profile_id IN ( SELECT profiles.id
           FROM profiles
          WHERE (profiles.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Store owners can view own store visits" ON "public"."store_visits" USING ((store_id IN ( SELECT affiliate_stores.id
   FROM affiliate_stores
  WHERE (affiliate_stores.profile_id IN ( SELECT profiles.id
           FROM profiles
          WHERE (profiles.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_logs' AND policyname='Only admins can read all chat logs' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() IN ( SELECT profiles.user_id
   FROM profiles
  WHERE (profiles.role = ''admin''::text)))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Only admins can read all chat logs" ON "public"."chat_logs" USING (((select auth.uid()) IN ( SELECT profiles.user_id
   FROM profiles
  WHERE (profiles.role = 'admin'::text))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_integrations' AND policyname='Users can delete their own integrations' AND cmd='DELETE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(user_id = auth.uid())' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can delete their own integrations" ON "public"."user_integrations" USING ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_integrations' AND policyname='Users can insert their own integrations' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(user_id = auth.uid())') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can insert their own integrations" ON "public"."user_integrations" WITH CHECK ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_integrations' AND policyname='Users can update their own integrations' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(user_id = auth.uid())' AND with_check IS NOT DISTINCT FROM '(user_id = auth.uid())') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can update their own integrations" ON "public"."user_integrations" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_integrations' AND policyname='Users can view their own integrations' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(user_id = auth.uid())' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own integrations" ON "public"."user_integrations" USING ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='imported_products' AND policyname='Users can delete their own imported products' AND cmd='DELETE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(user_id = auth.uid())' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can delete their own imported products" ON "public"."imported_products" USING ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='imported_products' AND policyname='Users can insert their own imported products' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(user_id = auth.uid())') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can insert their own imported products" ON "public"."imported_products" WITH CHECK ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='imported_products' AND policyname='Users can update their own imported products' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(user_id = auth.uid())' AND with_check IS NOT DISTINCT FROM '(user_id = auth.uid())') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can update their own imported products" ON "public"."imported_products" USING ((user_id = (select auth.uid()))) WITH CHECK ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='imported_products' AND policyname='Users can view their own imported products' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(user_id = auth.uid())' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own imported products" ON "public"."imported_products" USING ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_history' AND policyname='Users can insert their own sync history' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(user_id = auth.uid())') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can insert their own sync history" ON "public"."sync_history" WITH CHECK ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sync_history' AND policyname='Users can view their own sync history' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(user_id = auth.uid())' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own sync history" ON "public"."sync_history" USING ((user_id = (select auth.uid())));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_images' AND policyname='Product owners can manage their product images' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_images.product_id) AND (products.seller_id = auth.uid()))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Product owners can manage their product images" ON "public"."product_images" USING ((EXISTS ( SELECT 1
   FROM products
  WHERE ((products.id = product_images.product_id) AND (products.seller_id = (select auth.uid()))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seller_ratings' AND policyname='Users can create seller ratings' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(auth.uid() = rater_id)') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can create seller ratings" ON "public"."seller_ratings" WITH CHECK (((select auth.uid()) = rater_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seller_ratings' AND policyname='Users can delete their own ratings' AND cmd='DELETE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = rater_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can delete their own ratings" ON "public"."seller_ratings" USING (((select auth.uid()) = rater_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seller_ratings' AND policyname='Users can update their own ratings' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = rater_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can update their own ratings" ON "public"."seller_ratings" USING (((select auth.uid()) = rater_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='review_helpful' AND policyname='Authenticated users can vote on reviews' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(auth.uid() = user_id)') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Authenticated users can vote on reviews" ON "public"."review_helpful" WITH CHECK (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='review_helpful' AND policyname='Users can delete their own votes' AND cmd='DELETE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = user_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can delete their own votes" ON "public"."review_helpful" USING (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='review_helpful' AND policyname='Users can update their own votes' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = user_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can update their own votes" ON "public"."review_helpful" USING (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_badges' AND policyname='Users can view their own badges' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = user_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own badges" ON "public"."user_badges" USING (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='affiliate_stats' AND policyname='Users can update their own stats' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = user_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can update their own stats" ON "public"."affiliate_stats" USING (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='product_variants' AND policyname='variants_admin_all' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))' AND with_check IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "variants_admin_all" ON "public"."product_variants" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendors' AND policyname='Vendors can update own profile' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((auth.uid())::text = email)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Vendors can update own profile" ON "public"."vendors" USING ((((select auth.uid()))::text = email));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_subscriptions' AND policyname='Affiliates can view their subscriptions' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = affiliate_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Affiliates can view their subscriptions" ON "public"."customer_subscriptions" USING (((select auth.uid()) = affiliate_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customer_subscriptions' AND policyname='Users can view own subscriptions' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = customer_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view own subscriptions" ON "public"."customer_subscriptions" USING (((select auth.uid()) = customer_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscription_billings' AND policyname='Users can view own billing' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM customer_subscriptions cs
  WHERE ((cs.id = subscription_billings.subscription_id) AND (cs.customer_id = auth.uid()))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view own billing" ON "public"."subscription_billings" USING ((EXISTS ( SELECT 1
   FROM customer_subscriptions cs
  WHERE ((cs.id = subscription_billings.subscription_id) AND (cs.customer_id = (select auth.uid()))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_orders' AND policyname='Sellers can view vendor orders for their products' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM order_items
  WHERE ((order_items.order_id = vendor_orders.order_id) AND ((order_items.seller_id)::text = (auth.uid())::text))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Sellers can view vendor orders for their products" ON "public"."vendor_orders" USING ((EXISTS ( SELECT 1
   FROM order_items
  WHERE ((order_items.order_id = vendor_orders.order_id) AND ((order_items.seller_id)::text = ((select auth.uid()))::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vendor_orders' AND policyname='Users can view their own vendor orders' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = vendor_orders.order_id) AND (orders.customer_email = (auth.jwt() ->> ''email''::text)))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own vendor orders" ON "public"."vendor_orders" USING ((EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = vendor_orders.order_id) AND (orders.customer_email = ((select auth.jwt()) ->> 'email'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shipping_labels' AND policyname='Users can view their own shipping labels' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = shipping_labels.order_id) AND (orders.customer_email = (auth.jwt() ->> ''email''::text)))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own shipping labels" ON "public"."shipping_labels" USING ((EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = shipping_labels.order_id) AND (orders.customer_email = ((select auth.jwt()) ->> 'email'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='delivery_tracking' AND policyname='Users can view their own delivery tracking' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = delivery_tracking.order_id) AND (orders.customer_email = (auth.jwt() ->> ''email''::text)))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own delivery tracking" ON "public"."delivery_tracking" USING ((EXISTS ( SELECT 1
   FROM orders
  WHERE ((orders.id = delivery_tracking.order_id) AND (orders.customer_email = ((select auth.jwt()) ->> 'email'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referrals' AND policyname='Users can create referrals' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(auth.uid() = referee_id)') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can create referrals" ON "public"."referrals" WITH CHECK (((select auth.uid()) = referee_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referrals' AND policyname='Users can view their referrals' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((auth.uid() = referrer_id) OR (auth.uid() = referee_id))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their referrals" ON "public"."referrals" USING ((((select auth.uid()) = referrer_id) OR ((select auth.uid()) = referee_id)));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='referral_commissions' AND policyname='Users can view their referral commissions' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM referrals
  WHERE ((referrals.id = referral_commissions.referral_id) AND (referrals.referrer_id = auth.uid()))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their referral commissions" ON "public"."referral_commissions" USING ((EXISTS ( SELECT 1
   FROM referrals
  WHERE ((referrals.id = referral_commissions.referral_id) AND (referrals.referrer_id = (select auth.uid()))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reported_content' AND policyname='Admins can update reports' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (lower(COALESCE(profiles.primary_role, profiles.role, ''''::text)) = ''admin''::text))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Admins can update reports" ON "public"."reported_content" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (lower(COALESCE(profiles.primary_role, profiles.role, ''::text)) = 'admin'::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reported_content' AND policyname='Admins can view all reports' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (lower(COALESCE(profiles.primary_role, profiles.role, ''''::text)) = ''admin''::text))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Admins can view all reports" ON "public"."reported_content" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (lower(COALESCE(profiles.primary_role, profiles.role, ''::text)) = 'admin'::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reported_content' AND policyname='Users can report content' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(auth.uid() = reporter_id)') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can report content" ON "public"."reported_content" WITH CHECK (((select auth.uid()) = reporter_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reported_content' AND policyname='Users can view their own reports' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = reporter_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own reports" ON "public"."reported_content" USING (((select auth.uid()) = reporter_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dispute_messages' AND policyname='Users can send dispute messages' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(auth.uid() = sender_id)') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can send dispute messages" ON "public"."dispute_messages" WITH CHECK (((select auth.uid()) = sender_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='dispute_messages' AND policyname='Users can view dispute messages' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((EXISTS ( SELECT 1
   FROM disputes
  WHERE ((disputes.id = dispute_messages.dispute_id) AND ((disputes.filed_by = auth.uid()) OR (disputes.filed_against = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ''admin''::text)))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view dispute messages" ON "public"."dispute_messages" USING (((EXISTS ( SELECT 1
   FROM disputes
  WHERE ((disputes.id = dispute_messages.dispute_id) AND ((disputes.filed_by = (select auth.uid())) OR (disputes.filed_against = (select auth.uid())))))) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_moderation' AND policyname='Admins can manage moderation' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ''admin''::text))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Admins can manage moderation" ON "public"."user_moderation" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_moderation' AND policyname='Users can view their own moderation records' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = user_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own moderation records" ON "public"."user_moderation" USING (((select auth.uid()) = user_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seller_verification' AND policyname='Admins can manage verification' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ''admin''::text))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Admins can manage verification" ON "public"."seller_verification" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seller_verification' AND policyname='Sellers can update their verification' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = seller_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Sellers can update their verification" ON "public"."seller_verification" USING (((select auth.uid()) = seller_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='seller_verification' AND policyname='Sellers can view their verification' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(auth.uid() = seller_id)' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Sellers can view their verification" ON "public"."seller_verification" USING (((select auth.uid()) = seller_id));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='disputes' AND policyname='Admins can update disputes' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (lower(COALESCE(profiles.primary_role, profiles.role, ''''::text)) = ''admin''::text))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Admins can update disputes" ON "public"."disputes" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (lower(COALESCE(profiles.primary_role, profiles.role, ''::text)) = 'admin'::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='disputes' AND policyname='Admins can view all disputes' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (lower(COALESCE(profiles.primary_role, profiles.role, ''''::text)) = ''admin''::text))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Admins can view all disputes" ON "public"."disputes" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = (select auth.uid())) AND (lower(COALESCE(profiles.primary_role, profiles.role, ''::text)) = 'admin'::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='disputes' AND policyname='Users can create disputes' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(auth.uid() = filed_by)') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can create disputes" ON "public"."disputes" WITH CHECK (((select auth.uid()) = filed_by));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='disputes' AND policyname='Users can view their disputes' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((auth.uid() = filed_by) OR (auth.uid() = filed_against))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their disputes" ON "public"."disputes" USING ((((select auth.uid()) = filed_by) OR ((select auth.uid()) = filed_against)));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='moderation_log' AND policyname='Admins can create log entries' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ''admin''::text))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Admins can create log entries" ON "public"."moderation_log" WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='moderation_log' AND policyname='Admins can view moderation log' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ''admin''::text))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Admins can view moderation log" ON "public"."moderation_log" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.role = 'admin'::text)))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_pages' AND policyname='Users can manage their own pages' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = custom_pages.owner_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can manage their own pages" ON "public"."custom_pages" USING (((owner_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = custom_pages.owner_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_pages' AND policyname='Users can view their own pages' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = custom_pages.owner_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view their own pages" ON "public"."custom_pages" USING (((owner_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = custom_pages.owner_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings' AND policyname='Users can delete own store settings' AND cmd='DELETE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((seller_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can delete own store settings" ON "public"."store_settings" USING (((seller_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings' AND policyname='Users can insert own store settings' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '((seller_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = auth.uid())))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can insert own store settings" ON "public"."store_settings" WITH CHECK (((seller_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings' AND policyname='Users can update own store settings' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((seller_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM '((seller_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = auth.uid())))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can update own store settings" ON "public"."store_settings" USING (((seller_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = (select auth.uid()))))))) WITH CHECK (((seller_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings' AND policyname='Users can view own store settings' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((seller_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view own store settings" ON "public"."store_settings" USING (((seller_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = store_settings.seller_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='affiliate_store_settings' AND policyname='Users can delete own affiliate store settings' AND cmd='DELETE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((affiliate_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can delete own affiliate store settings" ON "public"."affiliate_store_settings" USING (((affiliate_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='affiliate_store_settings' AND policyname='Users can insert own affiliate store settings' AND cmd='INSERT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM NULL AND with_check IS NOT DISTINCT FROM '((affiliate_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = auth.uid())))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can insert own affiliate store settings" ON "public"."affiliate_store_settings" WITH CHECK (((affiliate_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='affiliate_store_settings' AND policyname='Users can update own affiliate store settings' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((affiliate_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM '((affiliate_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = auth.uid())))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can update own affiliate store settings" ON "public"."affiliate_store_settings" USING (((affiliate_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = (select auth.uid()))))))) WITH CHECK (((affiliate_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='affiliate_store_settings' AND policyname='Users can view own affiliate store settings' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((affiliate_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "Users can view own affiliate store settings" ON "public"."affiliate_store_settings" USING (((affiliate_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = affiliate_store_settings.affiliate_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payout_batch_items' AND policyname='payout_batch_items_payee_select' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((payee_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = auth.uid()) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text))))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "payout_batch_items_payee_select" ON "public"."payout_batch_items" USING (((payee_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.user_id = (select auth.uid())) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text)))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cj_products' AND policyname='admin_all_cj_products' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))' AND with_check IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "admin_all_cj_products" ON "public"."cj_products" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='category_map_cj_to_beezio' AND policyname='admin_all_category_map' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))' AND with_check IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "admin_all_category_map" ON "public"."category_map_cj_to_beezio" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pricing_rules' AND policyname='admin_all_pricing_rules' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))' AND with_check IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "admin_all_pricing_rules" ON "public"."pricing_rules" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shipping_rules' AND policyname='admin_all_shipping_rules' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))' AND with_check IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "admin_all_shipping_rules" ON "public"."shipping_rules" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='admin_all_audit_log' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))' AND with_check IS NOT DISTINCT FROM '(EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = auth.uid()) OR (p.id = auth.uid())) AND ((p.role = ''admin''::text) OR (p.primary_role = ''admin''::text)))))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "admin_all_audit_log" ON "public"."audit_log" USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE (((p.user_id = (select auth.uid())) OR (p.id = (select auth.uid()))) AND ((p.role = 'admin'::text) OR (p.primary_role = 'admin'::text))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='paypal_accounts' AND policyname='users manage own paypal accounts (by profile)' AND cmd='ALL' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '(user_id IN ( SELECT p.id
   FROM profiles p
  WHERE (p.user_id = auth.uid())))' AND with_check IS NOT DISTINCT FROM '(user_id IN ( SELECT p.id
   FROM profiles p
  WHERE (p.user_id = auth.uid())))') THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "users manage own paypal accounts (by profile)" ON "public"."paypal_accounts" USING ((user_id IN ( SELECT p.id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid()))))) WITH CHECK ((user_id IN ( SELECT p.id
   FROM profiles p
  WHERE (p.user_id = (select auth.uid())))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payout_items' AND policyname='users can read own payout items' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((payee_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payout_items.payee_user_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "users can read own payout items" ON "public"."payout_items" USING (((payee_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payout_items.payee_user_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payout_snapshots' AND policyname='users can read own payout snapshots' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((payee_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payout_snapshots.payee_user_id) AND (p.user_id = auth.uid())))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "users can read own payout snapshots" ON "public"."payout_snapshots" USING (((payee_user_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = payout_snapshots.payee_user_id) AND (p.user_id = (select auth.uid())))))));
DO $guard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_money_ledger' AND policyname='users can read own order money ledger rows' AND cmd='SELECT' AND permissive='PERMISSIVE' AND qual IS NOT DISTINCT FROM '((payee_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = order_money_ledger.payee_id) AND (p.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_money_ledger.order_id) AND ((o.buyer_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles buyer_profile
          WHERE ((buyer_profile.id = o.buyer_id) AND (buyer_profile.user_id = auth.uid())))))))))' AND with_check IS NOT DISTINCT FROM NULL) THEN RAISE EXCEPTION 'Policy changed since review'; END IF; END $guard$;
ALTER POLICY "users can read own order money ledger rows" ON "public"."order_money_ledger" USING (((payee_id = (select auth.uid())) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = order_money_ledger.payee_id) AND (p.user_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_money_ledger.order_id) AND ((o.buyer_id = (select auth.uid())) OR (EXISTS ( SELECT 1
           FROM profiles buyer_profile
          WHERE ((buyer_profile.id = o.buyer_id) AND (buyer_profile.user_id = (select auth.uid())))))))))));

DO $verification$
DECLARE baseline record; actual jsonb;
BEGIN
 IF EXISTS(
   (SELECT schemaname,tablename,policyname,cmd,roles,permissive FROM beezio_policy_before
    EXCEPT SELECT schemaname,tablename,policyname,cmd,roles,permissive FROM pg_policies WHERE schemaname='public')
   UNION ALL
   (SELECT schemaname,tablename,policyname,cmd,roles,permissive FROM pg_policies WHERE schemaname='public'
    EXCEPT SELECT schemaname,tablename,policyname,cmd,roles,permissive FROM beezio_policy_before)
 ) THEN RAISE EXCEPTION 'Policy command, role or permissiveness changed'; END IF;
 FOR baseline IN SELECT * FROM beezio_rls_before LOOP
  PERFORM set_config('request.jwt.claim.sub',coalesce(baseline.actor::text,''),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',baseline.actor,'role',baseline.db_role)::text,true);
  EXECUTE format('SET LOCAL ROLE %I',baseline.db_role);
  SELECT pg_temp.beezio_rls_snapshot(ARRAY['affiliate_stats','affiliate_store_products','affiliate_store_settings','affiliate_stores','audit_log','category_map_cj_to_beezio','chat_logs','cj_products','custom_pages','customer_subscriptions','delivery_tracking','dispute_messages','disputes','imported_products','moderation_log','order_items','order_money_ledger','orders','payment_distributions','payout_batch_items','payout_items','payout_ledger','payout_snapshots','paypal_accounts','pricing_rules','product_images','product_variants','products','profile_directory','profiles','referral_commissions','referrals','reported_content','review_helpful','seller_ratings','seller_verification','shipping_labels','shipping_rules','store_settings','store_visits','subscription_billings','sync_history','transactions','user_badges','user_integrations','user_moderation','user_roles','vendor_orders','vendors']::text[]) INTO actual;
  RESET ROLE;
  IF actual IS DISTINCT FROM baseline.snapshot THEN RAISE EXCEPTION 'Row visibility changed; policy optimization rolled back'; END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
END $verification$;
DROP FUNCTION pg_temp.beezio_rls_snapshot(text[]);
NOTIFY pgrst,'reload schema';
