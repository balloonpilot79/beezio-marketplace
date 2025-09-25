-- Tax Agreements and 1099 Tracking
-- Run this in your Supabase SQL Editor

-- Create tax_agreements table
CREATE TABLE IF NOT EXISTS tax_agreements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_type TEXT NOT NULL CHECK (agreement_type IN ('1099', 'independent_contractor', 'tax_withholding')),
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  document_version TEXT DEFAULT '1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stripe_account_creations table for tracking
CREATE TABLE IF NOT EXISTS stripe_account_creations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  stripe_account_id TEXT NOT NULL UNIQUE,
  user_email TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('seller', 'affiliate')),
  agreements_signed BOOLEAN DEFAULT false,
  onboarding_url TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create 1099_reports table for tracking issued forms
CREATE TABLE IF NOT EXISTS tax_1099_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  total_payments DECIMAL(10,2) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  document_url TEXT,
  status TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'sent', 'delivered')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tax_agreements_user_id ON tax_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_agreements_type ON tax_agreements(agreement_type);
CREATE INDEX IF NOT EXISTS idx_stripe_accounts_user_email ON stripe_account_creations(user_email);
CREATE INDEX IF NOT EXISTS idx_1099_reports_user_year ON tax_1099_reports(user_id, tax_year);

-- Enable RLS
ALTER TABLE tax_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_account_creations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_1099_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tax_agreements
CREATE POLICY "Users can view their own tax agreements" ON tax_agreements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tax agreements" ON tax_agreements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for stripe_account_creations (admin only)
CREATE POLICY "Only admins can view stripe account creations" ON stripe_account_creations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for 1099_reports
CREATE POLICY "Users can view their own 1099 reports" ON tax_1099_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage 1099 reports" ON tax_1099_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );