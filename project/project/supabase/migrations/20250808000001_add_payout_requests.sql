-- Add payout_requests table for affiliate/seller payout requests
-- This table tracks when users request payouts before they are processed

CREATE TABLE IF NOT EXISTS payout_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('affiliate', 'seller')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 25.00), -- Minimum $25 payout
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payout_requests
CREATE POLICY "Users can view their own payout requests" ON payout_requests 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payout requests" ON payout_requests 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payout requests" ON payout_requests 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_created_at ON payout_requests(created_at DESC);

-- Add updated_at trigger
CREATE TRIGGER update_payout_requests_updated_at
  BEFORE UPDATE ON payout_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE payout_requests IS 'User requests for affiliate/seller payouts';
COMMENT ON COLUMN payout_requests.amount IS 'Amount requested for payout (minimum $25)';
COMMENT ON COLUMN payout_requests.status IS 'Current status: pending, approved, rejected, processed';
