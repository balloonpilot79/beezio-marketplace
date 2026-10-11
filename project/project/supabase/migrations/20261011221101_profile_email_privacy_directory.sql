CREATE FUNCTION public.profile_directory_can_read_private(p_owner_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT p_owner_user_id = (select auth.uid()) OR (
 (select auth.uid()) IS NOT NULL AND (
 EXISTS (SELECT 1 FROM public.profiles a WHERE a.user_id=(select auth.uid())
 AND (lower(trim(coalesce(a.role,'')))='admin' OR lower(trim(coalesce(a.primary_role,'')))='admin'))
 OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=(select auth.uid()) AND r.role='admin' AND r.is_active=true)
 ));
$$;
REVOKE ALL ON FUNCTION public.profile_directory_can_read_private(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_directory_can_read_private(uuid) TO anon, authenticated, service_role;
CREATE OR REPLACE VIEW public.profile_directory WITH (security_barrier=true) AS
SELECT
 p.id,
 p.user_id,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.email ELSE NULL::text END AS email,
 p.full_name,
 p.role,
 p.primary_role,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.phone ELSE NULL::text END AS phone,
 p.bio,
 p.website,
 p.location,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.zip_code ELSE NULL::text END AS zip_code,
 p.avatar_url,
 p.created_at,
 p.updated_at,
 p.average_rating,
 p.review_count,
 p.store_logo_url,
 p.store_banner_url,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.total_earnings ELSE NULL::numeric(10,2) END AS total_earnings,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.recovery_codes ELSE NULL::text[] END AS recovery_codes,
 p.referral_code,
 p.username,
 p.subdomain,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.street_address ELSE NULL::text END AS street_address,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.city ELSE NULL::text END AS city,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.state ELSE NULL::text END AS state,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.country ELSE NULL::text END AS country,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.payment_customer_id ELSE NULL::text END AS payment_customer_id,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.payment_account_id ELSE NULL::text END AS payment_account_id,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.sale_email_notifications ELSE NULL::boolean END AS sale_email_notifications,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.recruited_by_influencer_id ELSE NULL::uuid END AS recruited_by_influencer_id,
 p.influencer_enabled,
 CASE WHEN public.profile_directory_can_read_private(p.user_id) THEN p.payout_email ELSE NULL::text END AS payout_email
FROM public.profiles p;
NOTIFY pgrst, 'reload schema';
REVOKE ALL ON public.profile_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_directory TO anon, authenticated, service_role;
COMMENT ON VIEW public.profile_directory IS 'Read-only profile projection: private fields are masked unless auth.uid owns the row or has a database-granted admin role. Definer access is intentional; security_barrier prevents predicates bypassing masks.';
CREATE FUNCTION public.profile_directory(public.products)
RETURNS SETOF public.profile_directory ROWS 1 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT d.* FROM public.profile_directory d
 WHERE d.id = ($1).seller_id OR d.user_id = ($1).seller_id
 ORDER BY (d.id = ($1).seller_id) DESC, d.created_at DESC, d.id
 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.profile_directory(public.products) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_directory(public.products) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
CREATE FUNCTION public.profile_directory(public.chat_logs)
RETURNS SETOF public.profile_directory ROWS 1 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT d.* FROM public.profile_directory d
 WHERE d.id = ($1).user_id OR d.user_id = ($1).user_id
 ORDER BY (d.id = ($1).user_id) DESC, d.created_at DESC, d.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.profile_directory(public.chat_logs) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_directory(public.chat_logs) TO anon, authenticated, service_role;
CREATE FUNCTION public.profile_directory(public.affiliate_stats)
RETURNS SETOF public.profile_directory ROWS 1 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT d.* FROM public.profile_directory d
 WHERE d.id = ($1).user_id OR d.user_id = ($1).user_id
 ORDER BY (d.id = ($1).user_id) DESC, d.created_at DESC, d.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.profile_directory(public.affiliate_stats) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_directory(public.affiliate_stats) TO anon, authenticated, service_role;
CREATE FUNCTION public.profile_directory(public.customer_subscriptions)
RETURNS SETOF public.profile_directory ROWS 1 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT d.* FROM public.profile_directory d
 WHERE d.id = ($1).customer_id OR d.user_id = ($1).customer_id
 ORDER BY (d.id = ($1).customer_id) DESC, d.created_at DESC, d.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.profile_directory(public.customer_subscriptions) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_directory(public.customer_subscriptions) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
