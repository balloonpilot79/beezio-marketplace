-- Create user_integrations table for API platform connections
CREATE TABLE IF NOT EXISTS public.user_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'shopify', 'printify', 'printful', 'etsy', 'amazon', 'ebay', etc.
    api_key TEXT, -- Encrypted API key
    store_url TEXT, -- Store URL for platforms that need it
    webhook_url TEXT, -- Webhook endpoint for real-time updates
    is_active BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'inactive', -- 'active', 'inactive', 'error', 'syncing'
    last_sync TIMESTAMPTZ,
    product_count INTEGER DEFAULT 0,
    sync_frequency TEXT DEFAULT 'manual', -- 'manual', 'hourly', 'daily', 'realtime'
    auto_sync_enabled BOOLEAN DEFAULT false,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{}', -- Platform-specific settings
    error_message TEXT, -- Last error if any
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON public.user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_platform ON public.user_integrations(platform);
CREATE INDEX IF NOT EXISTS idx_user_integrations_status ON public.user_integrations(status);

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own integrations"
    ON public.user_integrations
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
    ON public.user_integrations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
    ON public.user_integrations
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations"
    ON public.user_integrations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_user_integrations_updated_at ON public.user_integrations;
CREATE TRIGGER update_user_integrations_updated_at
    BEFORE UPDATE ON public.user_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_integrations_updated_at();

-- Add external_id column to products table to track imported products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source_platform TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT false;

-- Create index for external products
CREATE INDEX IF NOT EXISTS idx_products_external_id ON public.products(external_id);
CREATE INDEX IF NOT EXISTS idx_products_source_platform ON public.products(source_platform);

-- Create integration_logs table for tracking sync history
CREATE TABLE IF NOT EXISTS public.integration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    integration_id UUID REFERENCES public.user_integrations(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'connect', 'disconnect', 'sync', 'import', 'error'
    status TEXT NOT NULL, -- 'success', 'failed', 'partial'
    products_imported INTEGER DEFAULT 0,
    products_updated INTEGER DEFAULT 0,
    products_failed INTEGER DEFAULT 0,
    error_message TEXT,
    duration_ms INTEGER, -- How long the operation took
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON public.integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON public.integration_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integration logs"
    ON public.integration_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_integrations
            WHERE user_integrations.id = integration_logs.integration_id
            AND user_integrations.user_id = auth.uid()
        )
    );

-- Grant permissions
GRANT ALL ON public.user_integrations TO authenticated;
GRANT ALL ON public.integration_logs TO authenticated;

COMMENT ON TABLE public.user_integrations IS 'Stores API connections to external platforms for product import';
COMMENT ON TABLE public.integration_logs IS 'Logs all integration sync activities and errors';
