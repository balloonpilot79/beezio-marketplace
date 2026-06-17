-- =====================================================
-- Add Subdomain Support for Custom Stores
-- =====================================================
-- This migration adds subdomain fields and auto-generates
-- subdomains from user email addresses (e.g., jason@beezio.co → jason.beezio.co)

-- STEP 1: Add subdomain column to store_settings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'store_settings' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE store_settings ADD COLUMN subdomain TEXT UNIQUE;
    CREATE INDEX idx_store_settings_subdomain ON store_settings(subdomain);
  END IF;
END $$;

-- STEP 2: Add subdomain column to affiliate_store_settings
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_store_settings' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE affiliate_store_settings ADD COLUMN subdomain TEXT UNIQUE;
    CREATE INDEX idx_affiliate_store_settings_subdomain ON affiliate_store_settings(subdomain);
  END IF;
END $$;

-- STEP 3: Create function to generate subdomain from email
CREATE OR REPLACE FUNCTION generate_subdomain_from_email(email TEXT)
RETURNS TEXT AS $$
DECLARE
  username TEXT;
  base_subdomain TEXT;
  final_subdomain TEXT;
  counter INT := 0;
BEGIN
  -- Extract username before @ symbol
  username := LOWER(SPLIT_PART(email, '@', 1));
  
  -- Remove special characters, keep only alphanumeric and hyphens
  username := REGEXP_REPLACE(username, '[^a-z0-9-]', '', 'g');
  
  -- Remove leading/trailing hyphens
  username := TRIM(BOTH '-' FROM username);
  
  -- Ensure it's not empty
  IF username = '' OR username IS NULL THEN
    username := 'store';
  END IF;
  
  base_subdomain := username;
  final_subdomain := base_subdomain;
  
  -- Check if subdomain exists, append number if needed
  WHILE EXISTS (
    SELECT 1 FROM store_settings WHERE subdomain = final_subdomain
    UNION
    SELECT 1 FROM affiliate_store_settings WHERE subdomain = final_subdomain
  ) LOOP
    counter := counter + 1;
    final_subdomain := base_subdomain || counter;
  END LOOP;
  
  RETURN final_subdomain;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create trigger function to auto-set subdomain on insert
CREATE OR REPLACE FUNCTION auto_set_subdomain()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Only set subdomain if it's NULL
  IF NEW.subdomain IS NULL THEN
    -- Get user email based on seller_id or affiliate_id
    IF TG_TABLE_NAME = 'store_settings' THEN
      SELECT email INTO user_email FROM auth.users WHERE id = NEW.seller_id;
    ELSIF TG_TABLE_NAME = 'affiliate_store_settings' THEN
      SELECT email INTO user_email FROM auth.users WHERE id = NEW.affiliate_id;
    END IF;
    
    -- Generate and set subdomain
    IF user_email IS NOT NULL THEN
      NEW.subdomain := generate_subdomain_from_email(user_email);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: Create triggers for auto-subdomain generation
DROP TRIGGER IF EXISTS trigger_auto_subdomain_store ON store_settings;
CREATE TRIGGER trigger_auto_subdomain_store
  BEFORE INSERT ON store_settings
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_subdomain();

DROP TRIGGER IF EXISTS trigger_auto_subdomain_affiliate ON affiliate_store_settings;
CREATE TRIGGER trigger_auto_subdomain_affiliate
  BEFORE INSERT ON affiliate_store_settings
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_subdomain();

-- STEP 6: Backfill subdomains for existing records
DO $$
DECLARE
  rec RECORD;
  new_subdomain TEXT;
BEGIN
  -- Update store_settings
  FOR rec IN SELECT s.id, s.seller_id, u.email 
             FROM store_settings s
             JOIN auth.users u ON u.id = s.seller_id
             WHERE s.subdomain IS NULL
  LOOP
    new_subdomain := generate_subdomain_from_email(rec.email);
    UPDATE store_settings SET subdomain = new_subdomain WHERE id = rec.id;
  END LOOP;
  
  -- Update affiliate_store_settings
  FOR rec IN SELECT a.id, a.affiliate_id, u.email 
             FROM affiliate_store_settings a
             JOIN auth.users u ON u.id = a.affiliate_id
             WHERE a.subdomain IS NULL
  LOOP
    new_subdomain := generate_subdomain_from_email(rec.email);
    UPDATE affiliate_store_settings SET subdomain = new_subdomain WHERE id = rec.id;
  END LOOP;
END $$;

-- STEP 7: Add RLS policies for subdomain-based lookups
DROP POLICY IF EXISTS "Public can view stores by subdomain" ON store_settings;
CREATE POLICY "Public can view stores by subdomain" ON store_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view affiliate stores by subdomain" ON affiliate_store_settings;
CREATE POLICY "Public can view affiliate stores by subdomain" ON affiliate_store_settings
  FOR SELECT USING (true);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Subdomain support added successfully!';
  RAISE NOTICE '📋 Subdomains will be auto-generated from email addresses';
  RAISE NOTICE '🌐 Format: username@email.com → username.beezio.co';
  RAISE NOTICE '🔄 Existing records have been backfilled';
END $$;
