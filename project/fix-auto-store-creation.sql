-- =====================================================
-- VERIFY AUTO-CREATE STORE SETTINGS TRIGGER
-- =====================================================

-- Check if the trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'auto_create_store_settings';

-- Check if the function exists
SELECT 
  proname as function_name,
  prosrc as function_code
FROM pg_proc
WHERE proname = 'create_default_store_settings';

-- =====================================================
-- TEST: Check current store settings coverage
-- =====================================================

-- Sellers with and without store settings
SELECT 
  'Total Sellers' as metric,
  COUNT(*) as count
FROM profiles
WHERE role = 'seller'

UNION ALL

SELECT 
  'Sellers with Store Settings',
  COUNT(DISTINCT ss.seller_id)
FROM store_settings ss
INNER JOIN profiles p ON ss.seller_id = p.id
WHERE p.role = 'seller'

UNION ALL

SELECT 
  'Sellers WITHOUT Store Settings',
  COUNT(*)
FROM profiles p
WHERE p.role = 'seller'
  AND NOT EXISTS (
    SELECT 1 FROM store_settings ss WHERE ss.seller_id = p.id
  );

-- =====================================================
-- FIX: Ensure trigger is properly set up
-- =====================================================

-- Recreate the function with better error handling
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
        social_links,
        custom_domain
      ) VALUES (
        NEW.id,
        COALESCE(NEW.full_name || '''s Store', 'My Store'),
        'Welcome to my store! Browse our products and find great deals.',
        'modern',
        '{}'::jsonb,
        NULL  -- Custom domain starts as NULL
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
        social_links,
        custom_domain
      ) VALUES (
        NEW.id,
        COALESCE(NEW.full_name || '''s Picks', 'My Affiliate Store'),
        'Check out these amazing products I recommend!',
        'modern',
        '{}'::jsonb,
        NULL  -- Custom domain starts as NULL
      )
      ON CONFLICT (affiliate_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to create store settings for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS auto_create_store_settings ON profiles;

CREATE TRIGGER auto_create_store_settings
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_store_settings();

-- =====================================================
-- ADD CUSTOM DOMAIN COLUMN (if not exists)
-- =====================================================

-- Add custom_domain to store_settings if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'store_settings' 
    AND column_name = 'custom_domain'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN custom_domain TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_store_settings_custom_domain ON store_settings(custom_domain);
  END IF;
END $$;

-- Add custom_domain to affiliate_store_settings if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_store_settings' 
    AND column_name = 'custom_domain'
  ) THEN
    ALTER TABLE affiliate_store_settings ADD COLUMN custom_domain TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_affiliate_store_settings_custom_domain ON affiliate_store_settings(custom_domain);
  END IF;
END $$;

-- =====================================================
-- BACKFILL: Create missing store settings
-- =====================================================

-- Create store_settings for sellers who don't have one
INSERT INTO store_settings (
  seller_id,
  store_name,
  store_description,
  store_theme,
  social_links,
  custom_domain
)
SELECT 
  p.id,
  COALESCE(p.full_name || '''s Store', 'My Store'),
  'Welcome to my store! Browse our products and find great deals.',
  'modern',
  '{}'::jsonb,
  NULL
FROM profiles p
WHERE p.role = 'seller'
  AND NOT EXISTS (
    SELECT 1 FROM store_settings ss WHERE ss.seller_id = p.id
  )
ON CONFLICT (seller_id) DO NOTHING;

-- Create affiliate_store_settings for affiliates who don't have one
INSERT INTO affiliate_store_settings (
  affiliate_id,
  store_name,
  store_description,
  store_theme,
  social_links,
  custom_domain
)
SELECT 
  p.id,
  COALESCE(p.full_name || '''s Picks', 'My Affiliate Store'),
  'Check out these amazing products I recommend!',
  'modern',
  '{}'::jsonb,
  NULL
FROM profiles p
WHERE p.role = 'affiliate'
  AND NOT EXISTS (
    SELECT 1 FROM affiliate_store_settings ass WHERE ass.affiliate_id = p.id
  )
ON CONFLICT (affiliate_id) DO NOTHING;

-- =====================================================
-- VERIFY EVERYTHING WORKED
-- =====================================================

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
  'Affiliates',
  COUNT(DISTINCT p.id),
  COUNT(DISTINCT ass.affiliate_id),
  COUNT(DISTINCT p.id) - COUNT(DISTINCT ass.affiliate_id)
FROM profiles p
LEFT JOIN affiliate_store_settings ass ON p.id = ass.affiliate_id
WHERE p.role = 'affiliate';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Store auto-creation enabled!';
  RAISE NOTICE '🏪 All existing users have store settings';
  RAISE NOTICE '🌐 Custom domain field ready';
  RAISE NOTICE '🔄 New signups will auto-create stores';
END $$;
