-- Email Notifications Table - Simplified Version
-- This version avoids foreign key constraint issues

-- Create the table first without any constraints
CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID, -- No foreign key constraint for now
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
    content TEXT NOT NULL,
    metadata JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
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
DROP TRIGGER IF EXISTS trigger_update_email_notification_updated_at ON email_notifications;
CREATE TRIGGER trigger_update_email_notification_updated_at
    BEFORE UPDATE ON email_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_email_notification_updated_at();

-- Enable Row Level Security
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own email notifications" ON email_notifications;
DROP POLICY IF EXISTS "Service role can insert email notifications" ON email_notifications;
DROP POLICY IF EXISTS "Service role can update email notifications" ON email_notifications;

-- Create RLS policies
CREATE POLICY "Users can view their own email notifications" ON email_notifications
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Service role can insert email notifications" ON email_notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update email notifications" ON email_notifications
    FOR UPDATE USING (true);

-- Add comments for documentation
COMMENT ON TABLE email_notifications IS 'Stores all email notifications sent to users for tracking and analytics';
COMMENT ON COLUMN email_notifications.email_type IS 'Type of email notification (welcome, order_confirmation, etc.)';
COMMENT ON COLUMN email_notifications.metadata IS 'Additional JSON data specific to the email type';
COMMENT ON COLUMN email_notifications.status IS 'Status of the email (sent, failed, pending)';

-- Optional: Try to add foreign key constraint later (run this separately if needed)
-- ALTER TABLE email_notifications ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
