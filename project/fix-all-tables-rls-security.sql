-- Comprehensive RLS Security Fix for All Tables
-- Run this in Supabase SQL Editor to secure all tables

-- ========================================
-- 1. USERS TABLE
-- ========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Public can view basic user info for sellers and affiliates" ON public.users;

CREATE POLICY "Users can view their own profile"
ON public.users FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.users FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Public can view basic user info for sellers and affiliates"
ON public.users FOR SELECT TO public
USING (current_role IN ('seller', 'affiliate') AND is_active = true);

-- ========================================
-- 2. PRODUCTS TABLE
-- ========================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Sellers can view their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete their own products" ON public.products;

CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT TO public
USING (is_active = true);

CREATE POLICY "Sellers can view their own products"
ON public.products FOR SELECT TO authenticated
USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own products"
ON public.products FOR UPDATE TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own products"
ON public.products FOR DELETE TO authenticated
USING (seller_id = auth.uid());

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
USING (buyer_id = auth.uid());

CREATE POLICY "Sellers can view orders for their products"
ON public.orders FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = orders.id
    AND p.seller_id = auth.uid()
  )
);

CREATE POLICY "Buyers can insert their own orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Buyers can update their own orders"
ON public.orders FOR UPDATE TO authenticated
USING (buyer_id = auth.uid())
WITH CHECK (buyer_id = auth.uid());

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
    AND orders.buyer_id = auth.uid()
  )
);

CREATE POLICY "Sellers can view order items for their products"
ON public.order_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = order_items.product_id
    AND products.seller_id = auth.uid()
  )
);

CREATE POLICY "Users can insert order items for their orders"
ON public.order_items FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.buyer_id = auth.uid()
  )
);

-- ========================================
-- 5. AFFILIATE_LINKS TABLE
-- ========================================
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view their own links" ON public.affiliate_links;
DROP POLICY IF EXISTS "Affiliates can create their own links" ON public.affiliate_links;
DROP POLICY IF EXISTS "Anyone can view active affiliate links" ON public.affiliate_links;

CREATE POLICY "Affiliates can view their own links"
ON public.affiliate_links FOR SELECT TO authenticated
USING (affiliate_id = auth.uid());

CREATE POLICY "Affiliates can create their own links"
ON public.affiliate_links FOR INSERT TO authenticated
WITH CHECK (affiliate_id = auth.uid());

CREATE POLICY "Anyone can view active affiliate links"
ON public.affiliate_links FOR SELECT TO public
USING (is_active = true);

-- ========================================
-- 6. AFFILIATE_CLICKS TABLE
-- ========================================
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view their own clicks" ON public.affiliate_clicks;
DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.affiliate_clicks;

CREATE POLICY "Affiliates can view their own clicks"
ON public.affiliate_clicks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.affiliate_links
    WHERE affiliate_links.id = affiliate_clicks.link_id
    AND affiliate_links.affiliate_id = auth.uid()
  )
);

CREATE POLICY "Anyone can insert clicks"
ON public.affiliate_clicks FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- ========================================
-- 7. AFFILIATE_COMMISSIONS TABLE
-- ========================================
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates can view their own commissions" ON public.affiliate_commissions;

CREATE POLICY "Affiliates can view their own commissions"
ON public.affiliate_commissions FOR SELECT TO authenticated
USING (affiliate_id = auth.uid());

-- ========================================
-- 8. SELLER_PAYOUTS TABLE
-- ========================================
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can view their own payouts" ON public.seller_payouts;

CREATE POLICY "Sellers can view their own payouts"
ON public.seller_payouts FOR SELECT TO authenticated
USING (seller_id = auth.uid());

-- ========================================
-- 9. STORES TABLE (Custom Stores)
-- ========================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active stores" ON public.stores;
DROP POLICY IF EXISTS "Sellers can view their own stores" ON public.stores;
DROP POLICY IF EXISTS "Sellers can update their own stores" ON public.stores;
DROP POLICY IF EXISTS "Sellers can create their own stores" ON public.stores;

CREATE POLICY "Anyone can view active stores"
ON public.stores FOR SELECT TO public
USING (is_active = true);

CREATE POLICY "Sellers can view their own stores"
ON public.stores FOR SELECT TO authenticated
USING (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own stores"
ON public.stores FOR UPDATE TO authenticated
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can create their own stores"
ON public.stores FOR INSERT TO authenticated
WITH CHECK (seller_id = auth.uid());

-- ========================================
-- 10. REVIEWS TABLE
-- ========================================
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;

CREATE POLICY "Anyone can view approved reviews"
ON public.reviews FOR SELECT TO public
USING (status = 'approved');

CREATE POLICY "Users can view their own reviews"
ON public.reviews FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create reviews"
ON public.reviews FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reviews"
ON public.reviews FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ========================================
-- 11. CART ITEMS TABLE
-- ========================================
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cart" ON public.cart_items;
DROP POLICY IF EXISTS "Users can manage their own cart" ON public.cart_items;

CREATE POLICY "Users can view their own cart"
ON public.cart_items FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own cart"
ON public.cart_items FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check that RLS is enabled on all tables
SELECT 
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '✅'
        ELSE '❌'
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
