-- Migration for Store Settings
-- Add store_settings table for seller store customization

CREATE TABLE IF NOT EXISTS store_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    store_name TEXT,
    store_description TEXT,
    store_banner TEXT, -- URL to banner image
    store_logo TEXT, -- URL to logo image
    store_theme TEXT DEFAULT 'modern', -- Theme identifier
    custom_domain TEXT,
    social_links JSONB DEFAULT '{}', -- Social media links
    business_hours TEXT,
    shipping_policy TEXT,
    return_policy TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(seller_id)
);

-- Row Level Security
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Sellers can view their own store settings" ON store_settings
    FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert their own store settings" ON store_settings
    FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their own store settings" ON store_settings
    FOR UPDATE USING (seller_id = auth.uid()) WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own store settings" ON store_settings
    FOR DELETE USING (seller_id = auth.uid());

-- Public read access for store display
CREATE POLICY "Anyone can view store settings for public stores" ON store_settings
    FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_settings_seller_id ON store_settings(seller_id);
CREATE INDEX IF NOT EXISTS idx_store_settings_custom_domain ON store_settings(custom_domain) WHERE custom_domain IS NOT NULL;

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_store_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_store_settings_updated_at
    BEFORE UPDATE ON store_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_store_settings_updated_at();
