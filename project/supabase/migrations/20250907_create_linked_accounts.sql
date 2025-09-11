-- Migration for linked_accounts table
CREATE TABLE linked_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  platform TEXT NOT NULL,
  account_details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
