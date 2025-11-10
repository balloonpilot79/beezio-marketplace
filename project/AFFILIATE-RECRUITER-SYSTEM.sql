-- AFFILIATE RECRUITMENT & 2-TIER COMMISSION SYSTEM
-- This allows affiliates to recruit other affiliates and earn 5% passive income
-- Copy ALL and run in Supabase SQL Editor

-- 0. Ensure orders table has total_amount column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0;

-- 1. Add referred_by column to profiles table (who recruited this affiliate)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES profiles(id);

-- 2. Create affiliate_recruiters table to track recruitment relationships
CREATE TABLE IF NOT EXISTS affiliate_recruiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recruit_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recruitment_code VARCHAR(50) UNIQUE NOT NULL,
  recruited_at TIMESTAMPTZ DEFAULT NOW(),
  total_recruits INTEGER DEFAULT 0,
  total_passive_earnings DECIMAL(10,2) DEFAULT 0,
  UNIQUE(recruiter_id, recruit_id)
);

-- 3. Create recruiter_earnings table (separate from direct affiliate earnings)
CREATE TABLE IF NOT EXISTS recruiter_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recruit_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE affiliate_recruiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_earnings ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for affiliate_recruiters
CREATE POLICY "Recruiters can view their recruits" ON affiliate_recruiters
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = recruiter_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view recruitment stats" ON affiliate_recruiters
  FOR SELECT USING (true);

-- 6. RLS Policies for recruiter_earnings
CREATE POLICY "Recruiters can view their passive earnings" ON recruiter_earnings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = recruiter_id AND profiles.user_id = auth.uid())
  );

CREATE POLICY "Public can view recruiter earnings" ON recruiter_earnings
  FOR SELECT USING (true);

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);
CREATE INDEX IF NOT EXISTS idx_affiliate_recruiters_recruiter ON affiliate_recruiters(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_recruiters_recruit ON affiliate_recruiters(recruit_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_recruiters_code ON affiliate_recruiters(recruitment_code);
CREATE INDEX IF NOT EXISTS idx_recruiter_earnings_recruiter ON recruiter_earnings(recruiter_id, status);

-- 8. Create function to auto-create recruitment relationship AND default store on signup
CREATE OR REPLACE FUNCTION create_recruitment_relationship()
RETURNS TRIGGER AS $$
DECLARE
  recruitment_code VARCHAR(50);
  default_store_id UUID;
BEGIN
  -- Auto-create default Beezio store for EVERY new user
  INSERT INTO store_settings (
    user_id,
    store_name,
    store_description,
    store_url,
    theme_settings,
    is_active
  ) VALUES (
    NEW.id,
    NEW.full_name || '''s Store',
    'Welcome to my Beezio store! Browse our products and find great deals.',
    LOWER(REPLACE(NEW.username, ' ', '-')) || '-store',
    '{"primary_color": "#F59E0B", "secondary_color": "#1F2937", "font_family": "Inter", "layout": "grid", "banner_image": null, "logo_url": null}'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO default_store_id;
  
  -- Only if this profile was referred by someone
  IF NEW.referred_by IS NOT NULL THEN
    -- Generate recruitment code
    recruitment_code := 'REC-' || SUBSTRING(NEW.referred_by::text, 1, 8) || '-' || SUBSTRING(NEW.id::text, 1, 8);
    
    -- Create recruitment record
    INSERT INTO affiliate_recruiters (recruiter_id, recruit_id, recruitment_code)
    VALUES (NEW.referred_by, NEW.id, recruitment_code)
    ON CONFLICT (recruiter_id, recruit_id) DO NOTHING;
    
    -- Increment recruiter's total_recruits count
    UPDATE affiliate_recruiters
    SET total_recruits = total_recruits + 1
    WHERE recruiter_id = NEW.referred_by;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger on profile creation
DROP TRIGGER IF EXISTS auto_create_recruitment ON profiles;
CREATE TRIGGER auto_create_recruitment
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_recruitment_relationship();

-- 10. Update the earnings recording function to handle 2-tier commissions
CREATE OR REPLACE FUNCTION record_affiliate_earnings()
RETURNS TRIGGER AS $$
DECLARE
  recruiter_id_var UUID;
  recruiter_commission DECIMAL(10,2);
  platform_fee DECIMAL(10,2);
BEGIN
  -- Only record if there's an affiliate
  IF NEW.affiliate_id IS NOT NULL AND NEW.affiliate_commission > 0 THEN
    
    -- Affiliate ALWAYS gets their full commission (set by seller)
    INSERT INTO affiliate_earnings (affiliate_id, order_id, amount, status)
    VALUES (NEW.affiliate_id, NEW.id, NEW.affiliate_commission, 'pending');
    
    -- Check if this affiliate was recruited by someone
    SELECT referred_by INTO recruiter_id_var
    FROM profiles
    WHERE id = NEW.affiliate_id;
    
    -- If recruited, recruiter earns 5% from Beezio's platform fee
    IF recruiter_id_var IS NOT NULL THEN
      -- Calculate recruiter commission (5% of order total from Beezio's platform fee)
      -- Use NEW.total_amount if available, otherwise use platform_fee field
      IF NEW.total_amount IS NOT NULL AND NEW.total_amount > 0 THEN
        recruiter_commission := NEW.total_amount * 0.05;
      ELSIF NEW.platform_fee IS NOT NULL THEN
        recruiter_commission := NEW.platform_fee * 0.33; -- Approximately 5% of total from 15% platform fee
      ELSE
        recruiter_commission := 0;
      END IF;
      
      -- Only record if commission > 0
      IF recruiter_commission > 0 THEN
        -- Record recruiter's passive earnings (comes from Beezio's cut, not seller or affiliate)
        INSERT INTO recruiter_earnings (recruiter_id, recruit_id, order_id, amount, status)
        VALUES (recruiter_id_var, NEW.affiliate_id, NEW.id, recruiter_commission, 'pending');
        
        -- Update recruiter's total passive earnings (use COALESCE to handle NULL)
        UPDATE affiliate_recruiters
        SET total_passive_earnings = COALESCE(total_passive_earnings, 0) + recruiter_commission
        WHERE recruiter_id = recruiter_id_var AND recruit_id = NEW.affiliate_id;
      END IF;
    END IF;
    
    -- Update affiliate link stats if referral_code exists
    IF NEW.referral_code IS NOT NULL THEN
      UPDATE affiliate_links
      SET 
        conversions = conversions + 1,
        total_commission = total_commission + NEW.affiliate_commission
      WHERE referral_code = NEW.referral_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Recreate the trigger (it was updated above)
DROP TRIGGER IF EXISTS auto_record_affiliate_earnings ON orders;
CREATE TRIGGER auto_record_affiliate_earnings
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_affiliate_earnings();

-- SUCCESS!
-- =====================================================================
-- 2-Tier Affiliate Recruitment System Ready!
-- 
-- ✅ Affiliates can recruit other affiliates
-- ✅ Recruiters earn 5% passive income (comes from Beezio's platform fee)
-- ✅ Affiliates earn FULL commission set by seller (not reduced)
-- ✅ Recruiter's 5% comes from platform's cut, not affiliate's commission
-- ✅ Separate earnings tracking for passive income
-- ✅ Auto-creates default Beezio-themed store for EVERY new user
-- 
-- COMMISSION BREAKDOWN:
-- - Seller: Gets 100% of their desired amount
-- - Affiliate: Gets full commission rate set by seller
-- - Recruiter: Gets 5% of order total (from Beezio's platform fee)
-- - Beezio: Gets remaining platform fee after recruiter cut
-- - Stripe: Gets 2.9% + $0.30 processing fee
-- 
-- DEFAULT STORE THEME:
-- - Primary Color: Amber (#F59E0B)
-- - Secondary Color: Dark Gray (#1F2937)
-- - Font: Inter
-- - Layout: Grid
-- - Users can customize later in Store Settings
