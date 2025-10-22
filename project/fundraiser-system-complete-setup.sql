/*
  FUNDRAISER SYSTEM - COMPLETE DATABASE SETUP
  
  Like GoFundMe but for selling products to raise money for causes
  
  This creates:
  1. causes table - Main fundraiser campaigns
  2. cause_updates table - Progress updates from campaign creators
  3. cause_donations table - Track who donated what
  4. cause_products table - Link products to specific fundraisers
  5. cause_supporters table - Track supporters and their contributions
*/

-- ============================================
-- 1. CREATE CAUSES TABLE (Main Fundraiser Campaigns)
-- ============================================

CREATE TABLE IF NOT EXISTS causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  title TEXT NOT NULL,
  story TEXT NOT NULL,  -- The full story/description (GoFundMe style)
  short_description TEXT,  -- Short pitch for card display
  
  -- Financial Goals
  goal_amount NUMERIC(10, 2) NOT NULL,
  raised_amount NUMERIC(10, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  
  -- Images & Media
  image_url TEXT,
  video_url TEXT,  -- YouTube/Vimeo URL for story video
  additional_images TEXT[],  -- Array of additional photos
  
  -- Campaign Details
  category TEXT NOT NULL,  -- Medical, Education, Animals, Community, etc.
  location TEXT,  -- City, State for local causes
  beneficiary_name TEXT,  -- Who benefits from this fundraiser
  
  -- Creator Info
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  creator_name TEXT NOT NULL,
  creator_verified BOOLEAN DEFAULT false,  -- Verified identity
  
  -- Campaign Settings
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,  -- Show on homepage
  allow_anonymous_donations BOOLEAN DEFAULT true,
  end_date DATE,  -- When campaign ends (optional)
  
  -- Metrics
  supporter_count INTEGER DEFAULT 0,  -- Number of unique supporters
  share_count INTEGER DEFAULT 0,  -- Times shared on social media
  view_count INTEGER DEFAULT 0,  -- Page views
  product_count INTEGER DEFAULT 0,  -- Linked products for fundraising
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_donation_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_goal CHECK (goal_amount > 0),
  CONSTRAINT valid_raised CHECK (raised_amount >= 0),
  CONSTRAINT valid_category CHECK (category IN (
    'Medical & Health',
    'Education & Learning',
    'Animals & Pets',
    'Community & Neighbors',
    'Emergency & Disaster',
    'Sports & Recreation',
    'Creative & Arts',
    'Family & Memorial',
    'Business & Startups',
    'Environment & Nature',
    'Other'
  ))
);

-- ============================================
-- 2. CREATE CAUSE UPDATES TABLE (Progress Updates)
-- ============================================

CREATE TABLE IF NOT EXISTS cause_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cause_id UUID REFERENCES causes(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  
  -- Milestones
  is_milestone BOOLEAN DEFAULT false,  -- Reached a major goal
  milestone_amount NUMERIC(10, 2),  -- Amount at milestone
  
  -- Engagement
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CREATE CAUSE DONATIONS TABLE (Track Donations)
-- ============================================

CREATE TABLE IF NOT EXISTS cause_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cause_id UUID REFERENCES causes(id) ON DELETE CASCADE NOT NULL,
  
  -- Donor Info
  donor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL if anonymous
  donor_name TEXT,  -- Display name (or "Anonymous")
  is_anonymous BOOLEAN DEFAULT false,
  
  -- Donation Details
  amount NUMERIC(10, 2) NOT NULL,
  message TEXT,  -- Optional message to campaign creator
  
  -- Product-Based Donation
  via_product_id UUID REFERENCES products(id) ON DELETE SET NULL,  -- If donated via product purchase
  via_affiliate_id UUID REFERENCES profiles(id) ON DELETE SET NULL,  -- Affiliate who facilitated
  
  -- Payment
  stripe_payment_id TEXT,
  payment_status TEXT DEFAULT 'pending',  -- pending, completed, failed, refunded
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,  -- Show on public donation list
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_donation CHECK (amount > 0)
);

-- ============================================
-- 4. CREATE CAUSE PRODUCTS TABLE (Link Products to Fundraisers)
-- ============================================

CREATE TABLE IF NOT EXISTS cause_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cause_id UUID REFERENCES causes(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  
  -- Donation Settings
  donation_percentage NUMERIC(5, 2) DEFAULT 100,  -- % of profit going to cause (0-100)
  fixed_donation_amount NUMERIC(10, 2),  -- OR fixed amount per sale
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES profiles(id),  -- Who added this product
  
  -- Metrics
  total_sales INTEGER DEFAULT 0,
  total_raised NUMERIC(10, 2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: One product can only be linked once to a cause
  UNIQUE(cause_id, product_id),
  
  CONSTRAINT valid_percentage CHECK (donation_percentage >= 0 AND donation_percentage <= 100)
);

-- ============================================
-- 5. CREATE CAUSE SUPPORTERS TABLE (Track Supporters)
-- ============================================

CREATE TABLE IF NOT EXISTS cause_supporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cause_id UUID REFERENCES causes(id) ON DELETE CASCADE NOT NULL,
  supporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Support Details
  total_donated NUMERIC(10, 2) DEFAULT 0,
  donation_count INTEGER DEFAULT 0,
  is_recurring BOOLEAN DEFAULT false,  -- Monthly supporter
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,  -- Show on supporter list
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_donation_at TIMESTAMPTZ,
  
  -- Unique constraint: One supporter per cause
  UNIQUE(cause_id, supporter_id)
);

-- ============================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Causes indexes
CREATE INDEX IF NOT EXISTS idx_causes_creator ON causes(creator_id);
CREATE INDEX IF NOT EXISTS idx_causes_category ON causes(category);
CREATE INDEX IF NOT EXISTS idx_causes_is_active ON causes(is_active);
CREATE INDEX IF NOT EXISTS idx_causes_is_featured ON causes(is_featured);
CREATE INDEX IF NOT EXISTS idx_causes_created_at ON causes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_causes_raised_amount ON causes(raised_amount DESC);
CREATE INDEX IF NOT EXISTS idx_causes_end_date ON causes(end_date);

-- Cause updates indexes
CREATE INDEX IF NOT EXISTS idx_cause_updates_cause ON cause_updates(cause_id);
CREATE INDEX IF NOT EXISTS idx_cause_updates_created_at ON cause_updates(created_at DESC);

-- Cause donations indexes
CREATE INDEX IF NOT EXISTS idx_cause_donations_cause ON cause_donations(cause_id);
CREATE INDEX IF NOT EXISTS idx_cause_donations_donor ON cause_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_cause_donations_product ON cause_donations(via_product_id);
CREATE INDEX IF NOT EXISTS idx_cause_donations_created_at ON cause_donations(created_at DESC);

-- Cause products indexes
CREATE INDEX IF NOT EXISTS idx_cause_products_cause ON cause_products(cause_id);
CREATE INDEX IF NOT EXISTS idx_cause_products_product ON cause_products(product_id);
CREATE INDEX IF NOT EXISTS idx_cause_products_is_active ON cause_products(is_active);

-- Cause supporters indexes
CREATE INDEX IF NOT EXISTS idx_cause_supporters_cause ON cause_supporters(cause_id);
CREATE INDEX IF NOT EXISTS idx_cause_supporters_supporter ON cause_supporters(supporter_id);

-- ============================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE causes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cause_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cause_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cause_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cause_supporters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS POLICIES FOR CAUSES
-- ============================================

-- Public can view active causes
CREATE POLICY "Anyone can view active causes"
ON causes FOR SELECT
USING (is_active = true);

-- Creators can view their own causes (even inactive)
CREATE POLICY "Creators can view their own causes"
ON causes FOR SELECT
USING (auth.uid() = creator_id);

-- Authenticated users can create causes
CREATE POLICY "Authenticated users can create causes"
ON causes FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- Creators can update their own causes
CREATE POLICY "Creators can update their own causes"
ON causes FOR UPDATE
USING (auth.uid() = creator_id);

-- Creators can delete their own causes
CREATE POLICY "Creators can delete their own causes"
ON causes FOR DELETE
USING (auth.uid() = creator_id);

-- ============================================
-- 9. RLS POLICIES FOR CAUSE UPDATES
-- ============================================

-- Anyone can view updates for active causes
CREATE POLICY "Anyone can view cause updates"
ON cause_updates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM causes 
    WHERE causes.id = cause_updates.cause_id 
    AND causes.is_active = true
  )
);

-- Creators can create updates for their causes
CREATE POLICY "Creators can create updates"
ON cause_updates FOR INSERT
WITH CHECK (
  auth.uid() = creator_id 
  AND EXISTS (
    SELECT 1 FROM causes 
    WHERE causes.id = cause_updates.cause_id 
    AND causes.creator_id = auth.uid()
  )
);

-- Creators can update their own updates
CREATE POLICY "Creators can update their updates"
ON cause_updates FOR UPDATE
USING (auth.uid() = creator_id);

-- Creators can delete their own updates
CREATE POLICY "Creators can delete their updates"
ON cause_updates FOR DELETE
USING (auth.uid() = creator_id);

-- ============================================
-- 10. RLS POLICIES FOR CAUSE DONATIONS
-- ============================================

-- Public can view non-anonymous donations
CREATE POLICY "Anyone can view public donations"
ON cause_donations FOR SELECT
USING (is_public = true AND is_anonymous = false);

-- Donors can view their own donations
CREATE POLICY "Donors can view their own donations"
ON cause_donations FOR SELECT
USING (auth.uid() = donor_id);

-- Cause creators can view all donations to their causes
CREATE POLICY "Creators can view all donations to their causes"
ON cause_donations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM causes 
    WHERE causes.id = cause_donations.cause_id 
    AND causes.creator_id = auth.uid()
  )
);

-- Authenticated users can create donations
CREATE POLICY "Authenticated users can create donations"
ON cause_donations FOR INSERT
WITH CHECK (auth.uid() = donor_id OR is_anonymous = true);

-- ============================================
-- 11. RLS POLICIES FOR CAUSE PRODUCTS
-- ============================================

-- Anyone can view active cause products
CREATE POLICY "Anyone can view active cause products"
ON cause_products FOR SELECT
USING (is_active = true);

-- Cause creators can manage products for their causes
CREATE POLICY "Creators can manage cause products"
ON cause_products FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM causes 
    WHERE causes.id = cause_products.cause_id 
    AND causes.creator_id = auth.uid()
  )
);

-- Product sellers can add their products to causes
CREATE POLICY "Sellers can add their products to causes"
ON cause_products FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = cause_products.product_id 
    AND products.seller_id = auth.uid()
  )
);

-- ============================================
-- 12. RLS POLICIES FOR CAUSE SUPPORTERS
-- ============================================

-- Anyone can view public supporters
CREATE POLICY "Anyone can view public supporters"
ON cause_supporters FOR SELECT
USING (is_public = true);

-- Supporters can view their own support records
CREATE POLICY "Supporters can view their own records"
ON cause_supporters FOR SELECT
USING (auth.uid() = supporter_id);

-- System can manage supporter records (via triggers)
CREATE POLICY "Authenticated users can manage supporters"
ON cause_supporters FOR ALL
USING (auth.uid() = supporter_id);

-- ============================================
-- 13. TRIGGERS TO AUTO-UPDATE STATS
-- ============================================

-- Function to update cause raised_amount when donation is added
CREATE OR REPLACE FUNCTION update_cause_raised_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.payment_status = 'completed' THEN
    UPDATE causes
    SET 
      raised_amount = raised_amount + NEW.amount,
      supporter_count = (
        SELECT COUNT(DISTINCT donor_id) 
        FROM cause_donations 
        WHERE cause_id = NEW.cause_id 
        AND payment_status = 'completed'
        AND donor_id IS NOT NULL
      ),
      last_donation_at = NOW()
    WHERE id = NEW.cause_id;
    
    -- Update or create supporter record
    INSERT INTO cause_supporters (cause_id, supporter_id, total_donated, donation_count, last_donation_at)
    VALUES (NEW.cause_id, NEW.donor_id, NEW.amount, 1, NOW())
    ON CONFLICT (cause_id, supporter_id)
    DO UPDATE SET
      total_donated = cause_supporters.total_donated + NEW.amount,
      donation_count = cause_supporters.donation_count + 1,
      last_donation_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for cause_donations
DROP TRIGGER IF EXISTS update_cause_stats_on_donation ON cause_donations;
CREATE TRIGGER update_cause_stats_on_donation
  AFTER INSERT ON cause_donations
  FOR EACH ROW
  EXECUTE FUNCTION update_cause_raised_amount();

-- Function to update cause product_count
CREATE OR REPLACE FUNCTION update_cause_product_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE causes
  SET product_count = (
    SELECT COUNT(*) 
    FROM cause_products 
    WHERE cause_id = COALESCE(NEW.cause_id, OLD.cause_id)
    AND is_active = true
  )
  WHERE id = COALESCE(NEW.cause_id, OLD.cause_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for cause_products
DROP TRIGGER IF EXISTS update_cause_product_count_trigger ON cause_products;
CREATE TRIGGER update_cause_product_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON cause_products
  FOR EACH ROW
  EXECUTE FUNCTION update_cause_product_count();

-- ============================================
-- 14. HELPFUL VIEWS
-- ============================================

-- View for popular causes (most raised)
CREATE OR REPLACE VIEW popular_causes AS
SELECT 
  c.*,
  ROUND((c.raised_amount / c.goal_amount * 100)::numeric, 2) as progress_percentage,
  c.goal_amount - c.raised_amount as remaining_amount
FROM causes c
WHERE c.is_active = true
ORDER BY c.raised_amount DESC
LIMIT 10;

-- View for urgent causes (ending soon)
CREATE OR REPLACE VIEW urgent_causes AS
SELECT 
  c.*,
  ROUND((c.raised_amount / c.goal_amount * 100)::numeric, 2) as progress_percentage,
  c.end_date - CURRENT_DATE as days_remaining
FROM causes c
WHERE c.is_active = true
AND c.end_date IS NOT NULL
AND c.end_date > CURRENT_DATE
ORDER BY c.end_date ASC
LIMIT 10;

-- View for new causes (recently created)
CREATE OR REPLACE VIEW new_causes AS
SELECT 
  c.*,
  ROUND((c.raised_amount / c.goal_amount * 100)::numeric, 2) as progress_percentage
FROM causes c
WHERE c.is_active = true
ORDER BY c.created_at DESC
LIMIT 10;

-- ============================================
-- 15. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ============================================

-- Insert sample categories helper (you can customize)
COMMENT ON COLUMN causes.category IS 'Available categories: Medical & Health, Education & Learning, Animals & Pets, Community & Neighbors, Emergency & Disaster, Sports & Recreation, Creative & Arts, Family & Memorial, Business & Startups, Environment & Nature, Other';

-- ============================================
-- ✅ SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Fundraiser system database setup complete!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Created Tables:';
  RAISE NOTICE '  - causes (main fundraiser campaigns)';
  RAISE NOTICE '  - cause_updates (progress updates)';
  RAISE NOTICE '  - cause_donations (donation tracking)';
  RAISE NOTICE '  - cause_products (link products to fundraisers)';
  RAISE NOTICE '  - cause_supporters (supporter tracking)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RLS Policies: Enabled and configured';
  RAISE NOTICE '⚡ Triggers: Auto-update stats on donations/products';
  RAISE NOTICE '📊 Views: popular_causes, urgent_causes, new_causes';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Next Steps:';
  RAISE NOTICE '1. Run create-fundraiser-form.tsx to add campaign creation';
  RAISE NOTICE '2. Update FundraisersPage.tsx to use database';
  RAISE NOTICE '3. Update FundraiserDetailPage.tsx for full functionality';
  RAISE NOTICE '4. Add "Create Fundraiser" button to nav/dashboard';
END $$;
