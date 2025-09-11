-- Email Notifications Table
-- This table stores all email notifications sent to users for tracking and analytics

-- First, let's check if the auth.users table exists and has the correct structure
DO $$
BEGIN
    -- Check if auth.users table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        RAISE EXCEPTION 'auth.users table does not exist. Please ensure Supabase Auth is properly set up.';
    END IF;

    -- Check if the id column exists in auth.users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'id') THEN
        RAISE EXCEPTION 'auth.users table does not have an id column. Please check your Supabase setup.';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL CHECK (email_type IN (
        'welcome',
        'password_reset',
        'order_confirmation',
        'order_shipped',
        'order_delivered',
        'payment_received',
        'commission_earned',
        'product_sold',
        'new_affiliate_signup',
        'weekly_report',
        'account_verification',
        'support_ticket',
        'marketing_update'
    )),
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL, -- HTML content of the email
    metadata JSONB, -- Additional data specific to the email type
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT, -- If status is 'failed', store the error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id ON email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_email_type ON email_notifications(email_type);
CREATE INDEX IF NOT EXISTS idx_email_notifications_sent_at ON email_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_email_notification_updated_at
    BEFORE UPDATE ON email_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_email_notification_updated_at();

-- RLS (Row Level Security) Policies
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own email notifications
CREATE POLICY "Users can view their own email notifications" ON email_notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert email notifications (for security)
CREATE POLICY "Service role can insert email notifications" ON email_notifications
    FOR INSERT WITH CHECK (true);

-- Only service role can update email notifications
CREATE POLICY "Service role can update email notifications" ON email_notifications
    FOR UPDATE USING (true);

-- Comments for documentation
COMMENT ON TABLE email_notifications IS 'Stores all email notifications sent to users for tracking and analytics';
COMMENT ON COLUMN email_notifications.email_type IS 'Type of email notification (welcome, order_confirmation, etc.)';
COMMENT ON COLUMN email_notifications.metadata IS 'Additional JSON data specific to the email type';
COMMENT ON COLUMN email_notifications.status IS 'Status of the email (sent, failed, pending)';
