-- Migration for Universal Integrations
-- Support both sellers and affiliates importing products from external platforms

-- User Integrations Table
CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'shopify', 'printify', 'etsy', etc.
    api_key TEXT, -- Encrypted API key
    store_url TEXT, -- Store URL for platforms like Shopify
    webhook_url TEXT, -- Webhook endpoint for real-time sync
    is_active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'inactive', -- 'active', 'inactive', 'error', 'syncing'
    last_sync TIMESTAMP WITH TIME ZONE,
    product_count INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}', -- Platform-specific settings
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

-- Imported Products Table (tracks external product sources)
CREATE TABLE IF NOT EXISTS imported_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL, -- ID from external platform
    external_url TEXT, -- Original product URL
    platform TEXT NOT NULL,
    sync_status TEXT DEFAULT 'synced', -- 'synced', 'error', 'outdated'
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    external_data JSONB DEFAULT '{}', -- Store original external data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, external_id, user_id)
);

-- Sync History Table (track import/sync activities)
CREATE TABLE IF NOT EXISTS sync_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL, -- 'import', 'update', 'delete'
    products_processed INTEGER DEFAULT 0,
    products_successful INTEGER DEFAULT 0,
    products_failed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add integration fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_affiliate_product BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN DEFAULT false;

-- Row Level Security
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Policies for user_integrations
CREATE POLICY "Users can view their own integrations" ON user_integrations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own integrations" ON user_integrations
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own integrations" ON user_integrations
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own integrations" ON user_integrations
    FOR DELETE USING (user_id = auth.uid());

-- Policies for imported_products
CREATE POLICY "Users can view their own imported products" ON imported_products
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own imported products" ON imported_products
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own imported products" ON imported_products
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own imported products" ON imported_products
    FOR DELETE USING (user_id = auth.uid());

-- Policies for sync_history
CREATE POLICY "Users can view their own sync history" ON sync_history
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sync history" ON sync_history
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_platform ON user_integrations(platform);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON user_integrations(status);

CREATE INDEX IF NOT EXISTS idx_imported_products_user_id ON imported_products(user_id);
CREATE INDEX IF NOT EXISTS idx_imported_products_product_id ON imported_products(product_id);
CREATE INDEX IF NOT EXISTS idx_imported_products_external_id ON imported_products(external_id);
CREATE INDEX IF NOT EXISTS idx_imported_products_platform ON imported_products(platform);

CREATE INDEX IF NOT EXISTS idx_sync_history_user_id ON sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_integration_id ON sync_history(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON sync_history(status);

CREATE INDEX IF NOT EXISTS idx_products_external_id ON products(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_source_platform ON products(source_platform) WHERE source_platform IS NOT NULL;

-- Functions for automatic updates
CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_imported_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_user_integrations_updated_at
    BEFORE UPDATE ON user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_integrations_updated_at();

CREATE TRIGGER update_imported_products_updated_at
    BEFORE UPDATE ON imported_products
    FOR EACH ROW
    EXECUTE FUNCTION update_imported_products_updated_at();

-- Function to update integration product count
CREATE OR REPLACE FUNCTION update_integration_product_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update product count for the integration
    UPDATE user_integrations 
    SET product_count = (
        SELECT COUNT(*) 
        FROM imported_products 
        WHERE integration_id = COALESCE(NEW.integration_id, OLD.integration_id)
    )
    WHERE id = COALESCE(NEW.integration_id, OLD.integration_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update product counts
CREATE TRIGGER update_integration_count_on_import
    AFTER INSERT OR DELETE ON imported_products
    FOR EACH ROW
    EXECUTE FUNCTION update_integration_product_count();
