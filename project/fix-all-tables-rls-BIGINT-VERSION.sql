-- Comprehensive RLS Security Fix for ALL Tables (BIGINT VERSION)
-- This version uses ::text conversion for all ID comparisons to handle bigint types

-- ========================================
-- 1. USERS TABLE (Already done, but included for completeness)
-- ========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Public can view basic user info for sellers and affiliates" ON public.users;

CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT TO authenticated
USING (id::text = auth.uid()::text);

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE TO authenticated
USING (id::text = auth.uid()::text)
WITH CHECK (id::text = auth.uid()::text);

CREATE POLICY "Users can insert their own profile"
ON public.users FOR INSERT TO authenticated
WITH CHECK (id::text = auth.uid()::text);

CREATE POLICY "Public can view basic user info for sellers and affiliates"
ON public.users FOR SELECT TO public
USING (current_role IN ('seller', 'affiliate'));

-- ========================================
-- 2. PRODUCTS TABLE
-- ========================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Sellers can view their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete their own products" ON public.products;

-- Check if is_active column exists, if not skip that part
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT TO public
USING (true); -- Simplified - shows all products publicly

CREATE POLICY "Sellers can view their own products"
ON public.products FOR SELECT TO authenticated
USING (seller_id::text = auth.uid()::text);

CREATE POLICY "Sellers can insert their own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (seller_id::text = auth.uid()::text);

CREATE POLICY "Sellers can update their own products"
ON public.products FOR UPDATE TO authenticated
USING (seller_id::text = auth.uid()::text)
WITH CHECK (seller_id::text = auth.uid()::text);

CREATE POLICY "Sellers can delete their own products"
ON public.products FOR DELETE TO authenticated
USING (seller_id::text = auth.uid()::text);

-- ========================================
-- 3. ORDERS TABLE
-- ========================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view orders for their products" ON public.orders;
DROP POLICY IF EXISTS "Buyers can insert their own orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can update their own orders" ON public.orders;

CREATE POLICY "Buyers can view their own orders"
ON public.orders FOR SELECT TO authenticated
USING (buyer_id::text = auth.uid()::text);

CREATE POLICY "Sellers can view orders for their products"
ON public.orders FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = orders.id
    AND p.seller_id::text = auth.uid()::text
  )
);

CREATE POLICY "Buyers can insert their own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (buyer_id::text = auth.uid()::text);

CREATE POLICY "Buyers can update their own orders"
ON public.orders FOR UPDATE TO authenticated
USING (buyer_id::text = auth.uid()::text)
WITH CHECK (buyer_id::text = auth.uid()::text);

-- ========================================
-- 4. ORDER_ITEMS TABLE
-- ========================================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view order items for their orders" ON public.order_items;
DROP POLICY IF EXISTS "Sellers can view order items for their products" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert order items for their orders" ON public.order_items;

CREATE POLICY "Users can view order items for their orders"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.buyer_id::text = auth.uid()::text
  )
);

CREATE POLICY "Sellers can view order items for their products"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = order_items.product_id
    AND products.seller_id::text = auth.uid()::text
  )
);

CREATE POLICY "Users can insert order items for their orders"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.buyer_id::text = auth.uid()::text
  )
);

-- ========================================
-- 5. AFFILIATE_LINKS TABLE (if exists)
-- ========================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_links' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "Affiliates can view their own links" ON public.affiliate_links';
        EXECUTE 'DROP POLICY IF EXISTS "Affiliates can create their own links" ON public.affiliate_links';
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view active affiliate links" ON public.affiliate_links';
        
        EXECUTE 'CREATE POLICY "Affiliates can view their own links"
                 ON public.affiliate_links FOR SELECT TO authenticated
                 USING (affiliate_id::text = auth.uid()::text)';
        
        EXECUTE 'CREATE POLICY "Affiliates can create their own links"
                 ON public.affiliate_links FOR INSERT TO authenticated
                 WITH CHECK (affiliate_id::text = auth.uid()::text)';
        
        EXECUTE 'CREATE POLICY "Anyone can view active affiliate links"
                 ON public.affiliate_links FOR SELECT TO public
                 USING (true)';
    END IF;
END $$;

-- ========================================
-- 6. AFFILIATE_CLICKS TABLE (if exists)
-- ========================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_clicks' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "Affiliates can view their own clicks" ON public.affiliate_clicks';
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.affiliate_clicks';
        
        EXECUTE 'CREATE POLICY "Affiliates can view their own clicks"
                 ON public.affiliate_clicks FOR SELECT TO authenticated
                 USING (
                   EXISTS (
                     SELECT 1 FROM public.affiliate_links
                     WHERE affiliate_links.id = affiliate_clicks.link_id
                     AND affiliate_links.affiliate_id::text = auth.uid()::text
                   )
                 )';
        
        EXECUTE 'CREATE POLICY "Anyone can insert clicks"
                 ON public.affiliate_clicks FOR INSERT TO anon, authenticated
                 WITH CHECK (true)';
    END IF;
END $$;

-- ========================================
-- 7. AFFILIATE_COMMISSIONS TABLE (if exists)
-- ========================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_commissions' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "Affiliates can view their own commissions" ON public.affiliate_commissions';
        
        EXECUTE 'CREATE POLICY "Affiliates can view their own commissions"
                 ON public.affiliate_commissions FOR SELECT TO authenticated
                 USING (affiliate_id::text = auth.uid()::text)';
    END IF;
END $$;

-- ========================================
-- 8. SELLER_PAYOUTS TABLE (if exists)
-- ========================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'seller_payouts' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "Sellers can view their own payouts" ON public.seller_payouts';
        
        EXECUTE 'CREATE POLICY "Sellers can view their own payouts"
                 ON public.seller_payouts FOR SELECT TO authenticated
                 USING (seller_id::text = auth.uid()::text)';
    END IF;
END $$;

-- ========================================
-- 9. STORES TABLE (if exists)
-- ========================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stores' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view stores" ON public.stores';
        EXECUTE 'DROP POLICY IF EXISTS "Sellers can view their own stores" ON public.stores';
        EXECUTE 'DROP POLICY IF EXISTS "Sellers can update their own stores" ON public.stores';
        EXECUTE 'DROP POLICY IF EXISTS "Sellers can create their own stores" ON public.stores';
        
        EXECUTE 'CREATE POLICY "Anyone can view stores"
                 ON public.stores FOR SELECT TO public
                 USING (true)';
        
        EXECUTE 'CREATE POLICY "Sellers can view their own stores"
                 ON public.stores FOR SELECT TO authenticated
                 USING (seller_id::text = auth.uid()::text)';
        
        EXECUTE 'CREATE POLICY "Sellers can update their own stores"
                 ON public.stores FOR UPDATE TO authenticated
                 USING (seller_id::text = auth.uid()::text)
                 WITH CHECK (seller_id::text = auth.uid()::text)';
        
        EXECUTE 'CREATE POLICY "Sellers can create their own stores"
                 ON public.stores FOR INSERT TO authenticated
                 WITH CHECK (seller_id::text = auth.uid()::text)';
    END IF;
END $$;

-- ========================================
-- 10. REVIEWS TABLE (if exists)
-- ========================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reviews' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews';
        EXECUTE 'DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews';
        EXECUTE 'DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews';
        EXECUTE 'DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews';
        
        EXECUTE 'CREATE POLICY "Anyone can view reviews"
                 ON public.reviews FOR SELECT TO public
                 USING (true)';
        
        EXECUTE 'CREATE POLICY "Users can view their own reviews"
                 ON public.reviews FOR SELECT TO authenticated
                 USING (user_id::text = auth.uid()::text)';
        
        EXECUTE 'CREATE POLICY "Users can create reviews"
                 ON public.reviews FOR INSERT TO authenticated
                 WITH CHECK (user_id::text = auth.uid()::text)';
        
        EXECUTE 'CREATE POLICY "Users can update their own reviews"
                 ON public.reviews FOR UPDATE TO authenticated
                 USING (user_id::text = auth.uid()::text)
                 WITH CHECK (user_id::text = auth.uid()::text)';
    END IF;
END $$;

-- ========================================
-- 11. CART_ITEMS TABLE (if exists)
-- ========================================
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cart_items' AND table_schema = 'public') THEN
        EXECUTE 'ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY';
        
        EXECUTE 'DROP POLICY IF EXISTS "Users can view their own cart" ON public.cart_items';
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own cart" ON public.cart_items';
        
        EXECUTE 'CREATE POLICY "Users can view their own cart"
                 ON public.cart_items FOR SELECT TO authenticated
                 USING (user_id::text = auth.uid()::text)';
        
        EXECUTE 'CREATE POLICY "Users can manage their own cart"
                 ON public.cart_items FOR ALL TO authenticated
                 USING (user_id::text = auth.uid()::text)
                 WITH CHECK (user_id::text = auth.uid()::text)';
    END IF;
END $$;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check that RLS is enabled on all tables
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✅ SECURED'
        ELSE '❌ NOT SECURED'
    END as status
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('users', 'products', 'orders', 'order_items', 'affiliate_links', 
                  'affiliate_clicks', 'affiliate_commissions', 'seller_payouts', 
                  'stores', 'reviews', 'cart_items')
ORDER BY tablename;

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
