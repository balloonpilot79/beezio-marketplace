-- Email Notifications Setup - Fixed Version
-- This version fixes the syntax error in the COMMENT statements

-- Create custom types for better data integrity
CREATE TYPE email_type_enum AS ENUM (
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
);

CREATE TYPE email_status_enum AS ENUM (
    'sent',
    'failed',
    'pending'
);

-- Create the main table
CREATE TABLE IF NOT EXISTS email_notifications (
    id            UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    user_id       UUID,                                   -- optional FK, add later if needed
    email_type    email_type_enum NOT NULL,
    recipient_email TEXT NOT NULL,
    subject       TEXT NOT NULL,
    content       TEXT NOT NULL,
    metadata      JSONB,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    status        email_status_enum NOT NULL DEFAULT 'sent',
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Single-column indexes used in typical filters
CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id
    ON email_notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_email_notifications_email_type
    ON email_notifications (email_type);

CREATE INDEX IF NOT EXISTS idx_email_notifications_sent_at
    ON email_notifications (sent_at);

CREATE INDEX IF NOT EXISTS idx_email_notifications_status
    ON email_notifications (status);

-- Composite index for the common "user + status" lookup
CREATE INDEX IF NOT EXISTS idx_email_notifications_user_status
    ON email_notifications (user_id, status);

-- GIN index if you query inside the JSONB payload
CREATE INDEX IF NOT EXISTS idx_email_notifications_metadata
    ON email_notifications USING GIN (metadata);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION trg_update_email_notifications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_email_notifications_timestamp
    ON email_notifications;

CREATE TRIGGER trg_email_notifications_timestamp
    BEFORE UPDATE ON email_notifications
    FOR EACH ROW
    EXECUTE FUNCTION trg_update_email_notifications_timestamp();

-- Enable Row Level Security
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS policy_user_select ON email_notifications;
DROP POLICY IF EXISTS policy_service_insert ON email_notifications;
DROP POLICY IF EXISTS policy_service_update ON email_notifications;

-- Create new policies
CREATE POLICY policy_user_select
    ON email_notifications
    FOR SELECT
    USING ( (SELECT auth.uid()) = user_id );

CREATE POLICY policy_service_insert
    ON email_notifications
    FOR INSERT
    WITH CHECK (true);   -- service_role can write any row

CREATE POLICY policy_service_update
    ON email_notifications
    FOR UPDATE
    USING (true);

-- Add proper comments (fixed syntax)
COMMENT ON TABLE email_notifications IS 'Stores all email notifications sent to users for tracking and analytics';

COMMENT ON COLUMN email_notifications.email_type IS 'Type of email notification (welcome, order_confirmation, etc.)';

COMMENT ON COLUMN email_notifications.metadata IS 'Additional JSON data specific to the email type';

COMMENT ON COLUMN email_notifications.status IS 'Current delivery status (sent, failed, pending)';

-- Optional: Add foreign key constraint later if needed
-- ALTER TABLE email_notifications
--     ADD CONSTRAINT fk_email_notifications_user
--     FOREIGN KEY (user_id) REFERENCES auth.users (id)
--     ON DELETE CASCADE;
