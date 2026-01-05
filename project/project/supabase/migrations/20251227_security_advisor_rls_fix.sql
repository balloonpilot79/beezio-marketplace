-- Fix Supabase Security Advisor errors: enable RLS on tables exposed to PostgREST
-- Safe to run multiple times.

-- 1) order_items: policies may already exist; Security Advisor reported RLS disabled.
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;

-- Replace with robust read-only policy (write access is service role only).
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;

DO $$
DECLARE
  has_orders_user_id boolean := false;
  has_orders_buyer_id boolean := false;
  has_order_items_seller_id boolean := false;
  has_order_items_affiliate_id boolean := false;
  has_order_items_product_id boolean := false;
  has_products_seller_id boolean := false;
  buyer_guard text := '';
  seller_guard text := '';
  affiliate_guard text := '';
  using_sql text := '';
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'user_id'
  ) INTO has_orders_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'buyer_id'
  ) INTO has_orders_buyer_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'seller_id'
  ) INTO has_order_items_seller_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'affiliate_id'
  ) INTO has_order_items_affiliate_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id'
  ) INTO has_order_items_product_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'seller_id'
  ) INTO has_products_seller_id;

  IF has_orders_user_id AND has_orders_buyer_id THEN
    buyer_guard := '(o.user_id = auth.uid() OR o.buyer_id::text = auth.uid()::text)';
  ELSIF has_orders_user_id THEN
    buyer_guard := '(o.user_id = auth.uid())';
  ELSIF has_orders_buyer_id THEN
    buyer_guard := '(o.buyer_id::text = auth.uid()::text)';
  ELSE
    buyer_guard := '(false)';
  END IF;

  -- Seller access: prefer order_items.seller_id when present, else fall back to products.seller_id via order_items.product_id.
  IF has_order_items_seller_id THEN
    seller_guard := $S$
      (
        order_items.seller_id::text = auth.uid()::text
        OR order_items.seller_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
    $S$;
  ELSIF has_order_items_product_id AND has_products_seller_id THEN
    seller_guard := $S$
      EXISTS (
        SELECT 1
        FROM public.products pr
        WHERE pr.id = order_items.product_id
          AND (
            pr.seller_id::text = auth.uid()::text
            OR pr.seller_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
          )
      )
    $S$;
  ELSE
    seller_guard := '(false)';
  END IF;

  -- Affiliate access: only if the schema tracks affiliate_id on order_items.
  IF has_order_items_affiliate_id THEN
    affiliate_guard := $A$
      (
        order_items.affiliate_id::text = auth.uid()::text
        OR order_items.affiliate_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid())
      )
    $A$;
  ELSE
    affiliate_guard := '(false)';
  END IF;

  using_sql := format($POL$
(
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND %s
  )
  OR %s
  OR %s
)
$POL$, buyer_guard, seller_guard, affiliate_guard);

  EXECUTE 'CREATE POLICY "Users can view their own order items" ON public.order_items FOR SELECT TO authenticated USING ' || using_sql;
END $$;

DROP POLICY IF EXISTS "Service role can manage order_items" ON public.order_items;
CREATE POLICY "Service role can manage order_items"
ON public.order_items
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2) badge_types + user_badges: Security Advisor reported RLS disabled.
ALTER TABLE IF EXISTS public.badge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view badge types" ON public.badge_types;
CREATE POLICY "Anyone can view badge types"
ON public.badge_types
FOR SELECT
USING (true);

-- Keep public read for badges (used by leaderboard/marketing).
DROP POLICY IF EXISTS "Anyone can view user badges" ON public.user_badges;
CREATE POLICY "Anyone can view user badges"
ON public.user_badges
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can manage their own badges" ON public.user_badges;
CREATE POLICY "Users can manage their own badges"
ON public.user_badges
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) cj_api_tokens: enable RLS and restrict to service role by default (table contains secrets).
ALTER TABLE IF EXISTS public.cj_api_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage cj_api_tokens" ON public.cj_api_tokens;
CREATE POLICY "Service role can manage cj_api_tokens"
ON public.cj_api_tokens
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
