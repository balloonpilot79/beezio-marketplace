-- Test Auto Store Creation Trigger
-- This script simulates creating a new user and verifies store settings auto-create

-- 1. Create a test seller user
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Generate a test user ID
    test_user_id := gen_random_uuid();
    
    -- Insert test profile (this should trigger store creation)
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        test_user_id,
        'testuser_' || test_user_id::text || '@beezio.co',
        'Test Seller User',
        'seller'
    );
    
    -- Check if store_settings was created
    IF EXISTS (SELECT 1 FROM store_settings WHERE seller_id = test_user_id) THEN
        RAISE NOTICE 'SUCCESS: Store settings auto-created for seller %', test_user_id;
    ELSE
        RAISE NOTICE 'FAILED: Store settings NOT created for seller %', test_user_id;
    END IF;
    
    -- Show the created store settings
    RAISE NOTICE 'Store details: %', (
        SELECT json_build_object(
            'store_name', store_name,
            'store_description', store_description,
            'store_theme', store_theme,
            'custom_domain', custom_domain
        )
        FROM store_settings
        WHERE seller_id = test_user_id
    );
    
    -- Clean up test data
    DELETE FROM store_settings WHERE seller_id = test_user_id;
    DELETE FROM profiles WHERE id = test_user_id;
    
    RAISE NOTICE 'Test completed and cleaned up';
END $$;

-- 2. Create a test affiliate user
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Generate a test user ID
    test_user_id := gen_random_uuid();
    
    -- Insert test profile (this should trigger store creation)
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        test_user_id,
        'testaffiliate_' || test_user_id::text || '@beezio.co',
        'Test Affiliate User',
        'affiliate'
    );
    
    -- Check if affiliate_store_settings was created
    IF EXISTS (SELECT 1 FROM affiliate_store_settings WHERE affiliate_id = test_user_id) THEN
        RAISE NOTICE 'SUCCESS: Affiliate store settings auto-created for affiliate %', test_user_id;
    ELSE
        RAISE NOTICE 'FAILED: Affiliate store settings NOT created for affiliate %', test_user_id;
    END IF;
    
    -- Show the created store settings
    RAISE NOTICE 'Affiliate store details: %', (
        SELECT json_build_object(
            'store_name', store_name,
            'store_description', store_description,
            'store_theme', store_theme,
            'custom_domain', custom_domain
        )
        FROM affiliate_store_settings
        WHERE affiliate_id = test_user_id
    );
    
    -- Clean up test data
    DELETE FROM affiliate_store_settings WHERE affiliate_id = test_user_id;
    DELETE FROM profiles WHERE id = test_user_id;
    
    RAISE NOTICE 'Test completed and cleaned up';
END $$;

-- 3. Test role change from buyer to seller
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Generate a test user ID
    test_user_id := gen_random_uuid();
    
    -- Insert test profile as buyer
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        test_user_id,
        'rolechange_' || test_user_id::text || '@beezio.co',
        'Role Change Test User',
        'buyer'
    );
    
    RAISE NOTICE 'Created buyer account %', test_user_id;
    
    -- Update role to seller (should trigger store creation)
    UPDATE profiles
    SET role = 'seller'
    WHERE id = test_user_id;
    
    -- Check if store_settings was created
    IF EXISTS (SELECT 1 FROM store_settings WHERE seller_id = test_user_id) THEN
        RAISE NOTICE 'SUCCESS: Store settings auto-created when role changed to seller';
    ELSE
        RAISE NOTICE 'FAILED: Store settings NOT created when role changed to seller';
    END IF;
    
    -- Clean up test data
    DELETE FROM store_settings WHERE seller_id = test_user_id;
    DELETE FROM profiles WHERE id = test_user_id;
    
    RAISE NOTICE 'Role change test completed and cleaned up';
END $$;

-- 4. Final verification query
SELECT 
    'Sellers' as user_type,
    COUNT(DISTINCT p.id) as total_users,
    COUNT(DISTINCT ss.seller_id) as users_with_stores,
    COUNT(DISTINCT p.id) - COUNT(DISTINCT ss.seller_id) as missing_stores
FROM profiles p
LEFT JOIN store_settings ss ON p.id = ss.seller_id
WHERE p.role = 'seller'

UNION ALL

SELECT 
    'Affiliates' as user_type,
    COUNT(DISTINCT p.id) as total_users,
    COUNT(DISTINCT ass.affiliate_id) as users_with_stores,
    COUNT(DISTINCT p.id) - COUNT(DISTINCT ass.affiliate_id) as missing_stores
FROM profiles p
LEFT JOIN affiliate_store_settings ass ON p.id = ass.affiliate_id
WHERE p.role = 'affiliate';
