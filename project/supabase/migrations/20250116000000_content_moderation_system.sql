-- Content Moderation System
-- Complete moderation infrastructure for Beezio marketplace

-- =====================================================
-- 1. REPORTED CONTENT TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS reported_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('product', 'user', 'review', 'message', 'store')),
  content_id UUID NOT NULL,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'inappropriate_content',
    'spam',
    'scam_fraud',
    'counterfeit',
    'violence_hate',
    'adult_content',
    'copyright_violation',
    'misleading_information',
    'harassment',
    'other'
  )),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. DISPUTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  dispute_type TEXT NOT NULL CHECK (dispute_type IN (
    'product_not_received',
    'product_damaged',
    'wrong_item',
    'not_as_described',
    'refund_request',
    'quality_issue',
    'seller_unresponsive',
    'other'
  )),
  filed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  filed_against UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'awaiting_response', 'resolved', 'closed')),
  resolution TEXT,
  resolution_type TEXT CHECK (resolution_type IN ('refund_full', 'refund_partial', 'replacement', 'no_action', 'seller_favor', 'buyer_favor')),
  refund_amount DECIMAL(10,2),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. DISPUTE MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID REFERENCES disputes(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  message TEXT NOT NULL,
  attachments TEXT[],
  is_admin_message BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. USER BANS/SUSPENSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('warning', 'suspension', 'ban', 'restriction')),
  reason TEXT NOT NULL,
  duration_days INTEGER, -- NULL for permanent ban
  restrictions JSONB, -- e.g., {"cannot_list_products": true, "cannot_message": true}
  is_active BOOLEAN DEFAULT true,
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 5. SELLER VERIFICATION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS seller_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN (
    'pending',
    'documents_submitted',
    'under_review',
    'approved',
    'rejected',
    'suspended'
  )),
  business_name TEXT,
  business_type TEXT CHECK (business_type IN ('individual', 'sole_proprietorship', 'llc', 'corporation', 'partnership')),
  tax_id TEXT,
  business_address JSONB,
  identity_verified BOOLEAN DEFAULT false,
  business_verified BOOLEAN DEFAULT false,
  background_check_status TEXT CHECK (background_check_status IN ('not_started', 'pending', 'passed', 'failed')),
  documents_uploaded TEXT[], -- URLs to uploaded documents
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. MODERATION LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'user', 'product', 'review', etc.
  target_id UUID NOT NULL,
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  action_details JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_reported_content_status ON reported_content(status);
CREATE INDEX IF NOT EXISTS idx_reported_content_priority ON reported_content(priority);
CREATE INDEX IF NOT EXISTS idx_reported_content_type ON reported_content(content_type);
CREATE INDEX IF NOT EXISTS idx_reported_content_created ON reported_content(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_filed_by ON disputes(filed_by);
CREATE INDEX IF NOT EXISTS idx_disputes_created ON disputes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_created ON dispute_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_user_moderation_user ON user_moderation(user_id);
CREATE INDEX IF NOT EXISTS idx_user_moderation_active ON user_moderation(is_active);
CREATE INDEX IF NOT EXISTS idx_user_moderation_expires ON user_moderation(expires_at);

CREATE INDEX IF NOT EXISTS idx_seller_verification_status ON seller_verification(verification_status);
CREATE INDEX IF NOT EXISTS idx_seller_verification_seller ON seller_verification(seller_id);

CREATE INDEX IF NOT EXISTS idx_moderation_log_type ON moderation_log(target_type);
CREATE INDEX IF NOT EXISTS idx_moderation_log_target ON moderation_log(target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created ON moderation_log(created_at DESC);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_moderation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is banned/suspended
CREATE OR REPLACE FUNCTION is_user_restricted(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_restricted BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_moderation
    WHERE user_id = p_user_id
      AND is_active = true
      AND action_type IN ('ban', 'suspension')
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_is_restricted;
  
  RETURN v_is_restricted;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-expire suspensions
CREATE OR REPLACE FUNCTION auto_expire_suspensions()
RETURNS void AS $$
BEGIN
  UPDATE user_moderation
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_reported_content_timestamp
  BEFORE UPDATE ON reported_content
  FOR EACH ROW EXECUTE FUNCTION update_moderation_updated_at();

CREATE TRIGGER update_disputes_timestamp
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_moderation_updated_at();

CREATE TRIGGER update_user_moderation_timestamp
  BEFORE UPDATE ON user_moderation
  FOR EACH ROW EXECUTE FUNCTION update_moderation_updated_at();

CREATE TRIGGER update_seller_verification_timestamp
  BEFORE UPDATE ON seller_verification
  FOR EACH ROW EXECUTE FUNCTION update_moderation_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE reported_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_log ENABLE ROW LEVEL SECURITY;

-- Reported Content Policies
CREATE POLICY "Users can report content" ON reported_content
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON reported_content
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports" ON reported_content
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update reports" ON reported_content
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Dispute Policies
CREATE POLICY "Users can create disputes" ON disputes
  FOR INSERT WITH CHECK (auth.uid() = filed_by);

CREATE POLICY "Users can view their disputes" ON disputes
  FOR SELECT USING (auth.uid() IN (filed_by, filed_against));

CREATE POLICY "Admins can view all disputes" ON disputes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update disputes" ON disputes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Dispute Messages Policies
CREATE POLICY "Users can view dispute messages" ON dispute_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM disputes 
      WHERE disputes.id = dispute_messages.dispute_id 
        AND (disputes.filed_by = auth.uid() OR disputes.filed_against = auth.uid())
    ) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can send dispute messages" ON dispute_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- User Moderation Policies
CREATE POLICY "Users can view their own moderation records" ON user_moderation
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage moderation" ON user_moderation
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seller Verification Policies
CREATE POLICY "Sellers can view their verification" ON seller_verification
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their verification" ON seller_verification
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can manage verification" ON seller_verification
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Moderation Log Policies
CREATE POLICY "Admins can view moderation log" ON moderation_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can create log entries" ON moderation_log
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE reported_content IS 'Stores user reports of inappropriate content';
COMMENT ON TABLE disputes IS 'Order and transaction disputes between buyers and sellers';
COMMENT ON TABLE dispute_messages IS 'Messages in dispute resolution threads';
COMMENT ON TABLE user_moderation IS 'User bans, suspensions, and warnings';
COMMENT ON TABLE seller_verification IS 'Seller identity and business verification records';
COMMENT ON TABLE moderation_log IS 'Audit log of all moderation actions';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Content Moderation System created successfully!';
  RAISE NOTICE '📋 Tables created: reported_content, disputes, dispute_messages, user_moderation, seller_verification, moderation_log';
  RAISE NOTICE '🔧 Functions created: is_user_restricted(), auto_expire_suspensions()';
  RAISE NOTICE '🔒 RLS policies enabled for all tables';
END $$;
