-- Custom Store System: Templates, Messages, and Advanced Customization
-- Run this SQL in your Supabase SQL Editor

-- 1. Create store_messages table for internal contact forms
CREATE TABLE IF NOT EXISTS store_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_type TEXT NOT NULL CHECK (store_type IN ('seller', 'affiliate', 'fundraiser')),
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add template and layout fields to store_settings
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'modern-grid';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS product_page_template TEXT DEFAULT 'product-detailed';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{
  "header_style": "banner",
  "product_grid": "4-col",
  "sidebar": false,
  "footer_style": "detailed"
}'::jsonb;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_css TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_html_header TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS custom_html_footer TEXT;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS contact_page_enabled BOOLEAN DEFAULT true;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 3. Add template and layout fields to affiliate_store_settings
ALTER TABLE affiliate_store_settings ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'modern-grid';
ALTER TABLE affiliate_store_settings ADD COLUMN IF NOT EXISTS product_page_template TEXT DEFAULT 'product-detailed';
ALTER TABLE affiliate_store_settings ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{
  "header_style": "banner",
  "product_grid": "4-col",
  "sidebar": false,
  "footer_style": "detailed"
}'::jsonb;
ALTER TABLE affiliate_store_settings ADD COLUMN IF NOT EXISTS custom_css TEXT;
ALTER TABLE affiliate_store_settings ADD COLUMN IF NOT EXISTS custom_html_header TEXT;
ALTER TABLE affiliate_store_settings ADD COLUMN IF NOT EXISTS custom_html_footer TEXT;
ALTER TABLE affiliate_store_settings ADD COLUMN IF NOT EXISTS contact_page_enabled BOOLEAN DEFAULT true;
ALTER TABLE affiliate_store_settings ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 4. Add template and layout fields to fundraiser_store_settings (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fundraiser_store_settings') THEN
    ALTER TABLE fundraiser_store_settings ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'landing-fundraiser';
    ALTER TABLE fundraiser_store_settings ADD COLUMN IF NOT EXISTS product_page_template TEXT DEFAULT 'product-detailed';
    ALTER TABLE fundraiser_store_settings ADD COLUMN IF NOT EXISTS layout_config JSONB DEFAULT '{
      "header_style": "banner",
      "product_grid": "3-col",
      "sidebar": false,
      "footer_style": "detailed"
    }'::jsonb;
    ALTER TABLE fundraiser_store_settings ADD COLUMN IF NOT EXISTS custom_css TEXT;
    ALTER TABLE fundraiser_store_settings ADD COLUMN IF NOT EXISTS custom_html_header TEXT;
    ALTER TABLE fundraiser_store_settings ADD COLUMN IF NOT EXISTS custom_html_footer TEXT;
    ALTER TABLE fundraiser_store_settings ADD COLUMN IF NOT EXISTS contact_page_enabled BOOLEAN DEFAULT true;
    ALTER TABLE fundraiser_store_settings ADD COLUMN IF NOT EXISTS contact_email TEXT;
  END IF;
END $$;

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_store_messages_owner ON store_messages(store_owner_id);
CREATE INDEX IF NOT EXISTS idx_store_messages_status ON store_messages(status);
CREATE INDEX IF NOT EXISTS idx_store_messages_created ON store_messages(created_at DESC);

-- 6. Enable RLS on store_messages
ALTER TABLE store_messages ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for store_messages
CREATE POLICY "Store owners can view their messages" ON store_messages
  FOR SELECT USING (auth.uid() = store_owner_id);

CREATE POLICY "Anyone can send messages to stores" ON store_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Store owners can update their messages" ON store_messages
  FOR UPDATE USING (auth.uid() = store_owner_id);

CREATE POLICY "Store owners can delete their messages" ON store_messages
  FOR DELETE USING (auth.uid() = store_owner_id);

-- 8. Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_store_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS update_store_messages_updated_at_trigger ON store_messages;
CREATE TRIGGER update_store_messages_updated_at_trigger
  BEFORE UPDATE ON store_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_store_messages_updated_at();

-- 10. Add helper view for unread message counts
CREATE OR REPLACE VIEW store_message_counts AS
SELECT 
  store_owner_id,
  store_type,
  COUNT(*) FILTER (WHERE status = 'unread') as unread_count,
  COUNT(*) FILTER (WHERE status = 'read') as read_count,
  COUNT(*) as total_count
FROM store_messages
GROUP BY store_owner_id, store_type;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Custom Store System migration completed successfully!';
  RAISE NOTICE 'Tables created/updated: store_messages, store_settings, affiliate_store_settings';
  RAISE NOTICE 'New features: Store templates, custom HTML/CSS, contact forms, layout configuration';
END $$;
