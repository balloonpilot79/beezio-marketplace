-- =====================================================
-- Fundraiser System Implementation
-- =====================================================
-- Fundraisers are users who promote affiliate marketplace products
-- to reach a specific fundraising goal. They earn 5% commission.

-- STEP 1: Add 'fundraiser' role to profiles table check constraint
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  
  -- Add new constraint with 'fundraiser' role
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('buyer', 'seller', 'affiliate', 'fundraiser', 'admin'));
END $$;

-- STEP 2: Create fundraiser_settings table
CREATE TABLE IF NOT EXISTS fundraiser_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Fundraiser Details
  fundraiser_name TEXT NOT NULL,
  fundraiser_description TEXT,
  fundraising_goal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  current_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  goal_deadline TIMESTAMP WITH TIME ZONE,
  
  -- Store Branding
  store_name TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  
  -- Domain Settings
  subdomain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  show_goal_progress BOOLEAN DEFAULT true,
  thank_you_message TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(fundraiser_id)
);

-- Create indexes
CREATE INDEX idx_fundraiser_settings_fundraiser_id ON fundraiser_settings(fundraiser_id);
CREATE INDEX idx_fundraiser_settings_subdomain ON fundraiser_settings(subdomain);
CREATE INDEX idx_fundraiser_settings_custom_domain ON fundraiser_settings(custom_domain);
CREATE INDEX idx_fundraiser_settings_active ON fundraiser_settings(is_active);

-- STEP 3: Create fundraiser_products table (products they chose to promote)
CREATE TABLE IF NOT EXISTS fundraiser_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Custom pricing/notes for this fundraiser
  custom_description TEXT,
  sort_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  
  -- Metadata
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(fundraiser_id, product_id)
);

CREATE INDEX idx_fundraiser_products_fundraiser ON fundraiser_products(fundraiser_id);
CREATE INDEX idx_fundraiser_products_product ON fundraiser_products(product_id);
CREATE INDEX idx_fundraiser_products_featured ON fundraiser_products(fundraiser_id, is_featured);

-- STEP 4: Create fundraiser_commissions table (track earnings)
CREATE TABLE IF NOT EXISTS fundraiser_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fundraiser_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Commission Details
  transaction_amount DECIMAL(10, 2) NOT NULL,
  platform_fee DECIMAL(10, 2) NOT NULL, -- 15% of transaction
  stripe_fee DECIMAL(10, 2) NOT NULL, -- 2.9% + $0.60
  fundraiser_commission DECIMAL(10, 2) NOT NULL, -- 5% of transaction (from platform's 15%)
  beezio_net DECIMAL(10, 2) NOT NULL, -- Platform profit after all fees
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(order_id)
);

CREATE INDEX idx_fundraiser_commissions_fundraiser ON fundraiser_commissions(fundraiser_id);
CREATE INDEX idx_fundraiser_commissions_order ON fundraiser_commissions(order_id);
CREATE INDEX idx_fundraiser_commissions_status ON fundraiser_commissions(status);

-- STEP 5: Add trigger to auto-generate subdomain for fundraisers
DROP TRIGGER IF EXISTS trigger_auto_subdomain_fundraiser ON fundraiser_settings;
CREATE TRIGGER trigger_auto_subdomain_fundraiser
  BEFORE INSERT ON fundraiser_settings
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_subdomain_fundraiser();

-- Create fundraiser-specific subdomain function
CREATE OR REPLACE FUNCTION auto_set_subdomain_fundraiser()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- Only set subdomain if it's NULL
  IF NEW.subdomain IS NULL THEN
    -- Get user email
    SELECT email INTO user_email FROM auth.users WHERE id = NEW.fundraiser_id;
    
    -- Generate and set subdomain
    IF user_email IS NOT NULL THEN
      NEW.subdomain := generate_subdomain_from_email_fundraiser(user_email);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate subdomain (checks all tables for uniqueness)
CREATE OR REPLACE FUNCTION generate_subdomain_from_email_fundraiser(email TEXT)
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
    username := 'fundraiser';
  END IF;
  
  base_subdomain := username;
  final_subdomain := base_subdomain;
  
  -- Check if subdomain exists in ANY of the store tables
  WHILE EXISTS (
    SELECT 1 FROM store_settings WHERE subdomain = final_subdomain
    UNION
    SELECT 1 FROM affiliate_store_settings WHERE subdomain = final_subdomain
    UNION
    SELECT 1 FROM fundraiser_settings WHERE subdomain = final_subdomain
  ) LOOP
    counter := counter + 1;
    final_subdomain := base_subdomain || counter;
  END LOOP;
  
  RETURN final_subdomain;
END;
$$ LANGUAGE plpgsql;

-- STEP 6: Create function to calculate fundraiser commission on order
CREATE OR REPLACE FUNCTION calculate_fundraiser_commission(
  p_order_id UUID,
  p_transaction_amount DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_fundraiser_id UUID;
  v_platform_fee DECIMAL;
  v_stripe_fee DECIMAL;
  v_fundraiser_commission DECIMAL;
  v_beezio_net DECIMAL;
  v_flat_fee DECIMAL := 1.60;
  v_commission_id UUID;
BEGIN
  -- Get fundraiser_id from order (you'll need to add this field to orders table)
  SELECT fundraiser_id INTO v_fundraiser_id 
  FROM orders 
  WHERE id = p_order_id;
  
  -- If no fundraiser, return NULL
  IF v_fundraiser_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate fees
  v_platform_fee := p_transaction_amount * 0.15; -- 15%
  v_stripe_fee := (p_transaction_amount * 0.029) + 0.60; -- 2.9% + $0.60
  v_fundraiser_commission := p_transaction_amount * 0.05; -- 5% of transaction
  
  -- Beezio keeps: platform fee - stripe fee - fundraiser commission + flat fee
  v_beezio_net := v_platform_fee - v_stripe_fee - v_fundraiser_commission + v_flat_fee;
  
  -- Insert commission record
  INSERT INTO fundraiser_commissions (
    fundraiser_id,
    order_id,
    transaction_amount,
    platform_fee,
    stripe_fee,
    fundraiser_commission,
    beezio_net,
    status
  ) VALUES (
    v_fundraiser_id,
    p_order_id,
    p_transaction_amount,
    v_platform_fee,
    v_stripe_fee,
    v_fundraiser_commission,
    v_beezio_net,
    'pending'
  )
  RETURNING id INTO v_commission_id;
  
  -- Update fundraiser's current_amount
  UPDATE fundraiser_settings
  SET current_amount = current_amount + v_fundraiser_commission,
      updated_at = NOW()
  WHERE fundraiser_id = v_fundraiser_id;
  
  RETURN v_commission_id;
END;
$$ LANGUAGE plpgsql;

-- STEP 7: Add fundraiser_id to orders table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'fundraiser_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN fundraiser_id UUID REFERENCES auth.users(id);
    CREATE INDEX idx_orders_fundraiser ON orders(fundraiser_id);
  END IF;
END $$;

-- STEP 8: RLS Policies for fundraiser_settings
ALTER TABLE fundraiser_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active fundraiser stores" ON fundraiser_settings;
CREATE POLICY "Public can view active fundraiser stores" ON fundraiser_settings
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Fundraisers can manage their own settings" ON fundraiser_settings;
CREATE POLICY "Fundraisers can manage their own settings" ON fundraiser_settings
  FOR ALL USING (auth.uid() = fundraiser_id);

-- STEP 9: RLS Policies for fundraiser_products
ALTER TABLE fundraiser_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view fundraiser products" ON fundraiser_products;
CREATE POLICY "Public can view fundraiser products" ON fundraiser_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fundraiser_settings 
      WHERE fundraiser_id = fundraiser_products.fundraiser_id 
      AND is_active = true
    )
  );

DROP POLICY IF EXISTS "Fundraisers can manage their products" ON fundraiser_products;
CREATE POLICY "Fundraisers can manage their products" ON fundraiser_products
  FOR ALL USING (auth.uid() = fundraiser_id);

-- STEP 10: RLS Policies for fundraiser_commissions
ALTER TABLE fundraiser_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fundraisers can view their own commissions" ON fundraiser_commissions;
CREATE POLICY "Fundraisers can view their own commissions" ON fundraiser_commissions
  FOR SELECT USING (auth.uid() = fundraiser_id);

DROP POLICY IF EXISTS "Admins can manage all commissions" ON fundraiser_commissions;
CREATE POLICY "Admins can manage all commissions" ON fundraiser_commissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fundraiser system created successfully!';
  RAISE NOTICE '📋 Fundraisers can now sign up and promote affiliate products';
  RAISE NOTICE '💰 Commission: 5%% of transaction to fundraiser';
  RAISE NOTICE '🎯 Goal tracking enabled with progress display';
  RAISE NOTICE '🌐 Subdomains: fundraisername.beezio.co';
END $$;
