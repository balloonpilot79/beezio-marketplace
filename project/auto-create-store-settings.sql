-- =====================================================
-- AUTO-CREATE STORE SETTINGS FOR ALL SELLERS
-- =====================================================

-- This trigger will automatically create store_settings 
-- whenever a user tries to access their store customization

-- STEP 1: Create function to auto-create store settings
CREATE OR REPLACE FUNCTION create_default_store_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create for sellers or affiliates
  IF NEW.role IN ('seller', 'affiliate') THEN
    -- Create default store_settings for sellers
    IF NEW.role = 'seller' THEN
      INSERT INTO store_settings (
        seller_id,
        store_name,
        store_description,
        store_theme,
        social_links
      ) VALUES (
        NEW.id,
        COALESCE(NEW.full_name, 'My Store'),
        'Welcome to my store! Browse our products and find great deals.',
        'modern',
        '{}'::jsonb
      )
      ON CONFLICT (seller_id) DO NOTHING;
    END IF;
    
    -- Create default affiliate_store_settings for affiliates
    IF NEW.role = 'affiliate' THEN
      INSERT INTO affiliate_store_settings (
        affiliate_id,
        store_name,
        store_description,
        store_theme,
        social_links
      ) VALUES (
        NEW.id,
        COALESCE(NEW.full_name, 'My Affiliate Store'),
        'Check out these amazing products I recommend!',
        'modern',
        '{}'::jsonb
      )
      ON CONFLICT (affiliate_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 2: Drop trigger if it exists
DROP TRIGGER IF EXISTS auto_create_store_settings ON profiles;

-- STEP 3: Create trigger on profiles table
CREATE TRIGGER auto_create_store_settings
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_store_settings();

-- =====================================================
-- BACKFILL: Create store settings for existing sellers
-- =====================================================

-- Create store_settings for all existing sellers who don't have one
INSERT INTO store_settings (
  seller_id,
  store_name,
  store_description,
  store_theme,
  social_links
)
SELECT 
  p.id,
  COALESCE(p.full_name, 'My Store'),
  'Welcome to my store! Browse our products and find great deals.',
  'modern',
  '{}'::jsonb
FROM profiles p
WHERE p.role = 'seller'
  AND NOT EXISTS (
    SELECT 1 FROM store_settings ss WHERE ss.seller_id = p.id
  );

-- Create affiliate_store_settings for all existing affiliates who don't have one
INSERT INTO affiliate_store_settings (
  affiliate_id,
  store_name,
  store_description,
  store_theme,
  social_links
)
SELECT 
  p.id,
  COALESCE(p.full_name, 'My Affiliate Store'),
  'Check out these amazing products I recommend!',
  'modern',
  '{}'::jsonb
FROM profiles p
WHERE p.role = 'affiliate'
  AND NOT EXISTS (
    SELECT 1 FROM affiliate_store_settings ass WHERE ass.affiliate_id = p.id
  );

-- =====================================================
-- VERIFY: Check results
-- =====================================================

-- Count of sellers with store_settings
SELECT 
  'Sellers' as type,
  COUNT(DISTINCT p.id) as total_users,
  COUNT(DISTINCT ss.seller_id) as users_with_store
FROM profiles p
LEFT JOIN store_settings ss ON p.id = ss.seller_id
WHERE p.role = 'seller'

UNION ALL

-- Count of affiliates with affiliate_store_settings
SELECT 
  'Affiliates' as type,
  COUNT(DISTINCT p.id) as total_users,
  COUNT(DISTINCT ass.affiliate_id) as users_with_store
FROM profiles p
LEFT JOIN affiliate_store_settings ass ON p.id = ass.affiliate_id
WHERE p.role = 'affiliate';

-- Expected: Both total_users and users_with_store should match!

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Auto-create store settings enabled!';
  RAISE NOTICE '🔄 Trigger will create store settings for new sellers/affiliates';
  RAISE NOTICE '📋 Backfilled store settings for existing users';
END $$;
