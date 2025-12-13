-- ========================================
-- TEST STRIPE PRODUCT INSERT (MARKETPLACE)
-- ========================================
-- Goal: Insert 1 simple product that WILL show in the marketplace
-- (requires: products.is_active = true AND products.affiliate_enabled = true)
--
-- Run in Supabase SQL editor.

DO $$
DECLARE
  seller_uuid UUID;
  inserted_id UUID;
BEGIN
  -- Pick any existing seller/admin/fundraiser profile to own the product.
  SELECT p.id
  INTO seller_uuid
  FROM public.profiles p
  WHERE COALESCE(p.primary_role, p.role) IN ('seller', 'admin', 'fundraiser')
  ORDER BY p.created_at NULLS LAST
  LIMIT 1;

  IF seller_uuid IS NULL THEN
    RAISE EXCEPTION 'No seller/admin/fundraiser profile found in public.profiles. Create one account first.';
  END IF;

  INSERT INTO public.products (
    title,
    description,
    price,
    currency,
    images,
    seller_id,
    is_active,
    affiliate_enabled,
    commission_rate,
    commission_type,
    flat_commission_amount,
    shipping_cost,
    stock_quantity,
    lineage,
    tags,
    videos,
    views_count,
    clicks_count,
    conversions_count,
    created_at,
    updated_at
  ) VALUES (
    'Stripe Test Product (Do Not Ship)',
    'Test product for running checkout through Stripe. Safe to delete after testing.',
    10.00,
    'USD',
    ARRAY[
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=60'
    ]::text[],
    seller_uuid,
    true,
    true,
    15,
    'percentage',
    0,
    0,
    999,
    'SELLER_DIRECT',
    ARRAY['test', 'stripe', 'beezio']::text[],
    ARRAY[]::text[],
    0,
    0,
    0,
    NOW(),
    NOW()
  )
  RETURNING id INTO inserted_id;

  RAISE NOTICE '✅ Inserted Stripe test product id: %', inserted_id;
  RAISE NOTICE 'Open: /product/%', inserted_id;
END $$;

-- Quick verification (shows the newest test product)
SELECT id, title, price, currency, is_active, affiliate_enabled, commission_rate, seller_id, created_at
FROM public.products
WHERE title = 'Stripe Test Product (Do Not Ship)'
ORDER BY created_at DESC
LIMIT 5;

-- Cleanup (optional)
-- DELETE FROM public.products WHERE title = 'Stripe Test Product (Do Not Ship)';
