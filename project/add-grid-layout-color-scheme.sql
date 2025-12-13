-- Add grid_layout and color_scheme options to store settings tables
-- This enables customizable product grid layouts and color schemes for all store types

-- Update store_settings (seller stores)
ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS color_scheme JSONB DEFAULT '{
  "primary": "#f59e0b",
  "secondary": "#3b82f6", 
  "accent": "#ef4444",
  "background": "#ffffff",
  "text": "#1f2937"
}'::jsonb;

-- Add grid_layout to layout_config in store_settings
UPDATE store_settings 
SET layout_config = jsonb_set(
  COALESCE(layout_config, '{}'::jsonb),
  '{grid_layout}',
  '"standard"'::jsonb,
  true
)
WHERE layout_config IS NULL OR NOT layout_config ? 'grid_layout';

-- Update affiliate_store_settings
ALTER TABLE affiliate_store_settings 
ADD COLUMN IF NOT EXISTS color_scheme JSONB DEFAULT '{
  "primary": "#f59e0b",
  "secondary": "#3b82f6",
  "accent": "#ef4444", 
  "background": "#ffffff",
  "text": "#1f2937"
}'::jsonb;

-- Add grid_layout to layout_config in affiliate_store_settings
UPDATE affiliate_store_settings 
SET layout_config = jsonb_set(
  COALESCE(layout_config, '{}'::jsonb),
  '{grid_layout}',
  '"standard"'::jsonb,
  true
)
WHERE layout_config IS NULL OR NOT layout_config ? 'grid_layout';

-- Update fundraiser_store_settings
ALTER TABLE fundraiser_store_settings 
ADD COLUMN IF NOT EXISTS color_scheme JSONB DEFAULT '{
  "primary": "#10b981",
  "secondary": "#3b82f6",
  "accent": "#ef4444",
  "background": "#ffffff", 
  "text": "#1f2937"
}'::jsonb;

-- Add grid_layout to layout_config in fundraiser_store_settings
UPDATE fundraiser_store_settings 
SET layout_config = jsonb_set(
  COALESCE(layout_config, '{}'::jsonb),
  '{grid_layout}',
  '"standard"'::jsonb,
  true
)
WHERE layout_config IS NULL OR NOT layout_config ? 'grid_layout';

-- Add comments for documentation
COMMENT ON COLUMN store_settings.color_scheme IS 'Custom color scheme for store: primary, secondary, accent, background, text colors';
COMMENT ON COLUMN affiliate_store_settings.color_scheme IS 'Custom color scheme for affiliate store: primary, secondary, accent, background, text colors';
COMMENT ON COLUMN fundraiser_store_settings.color_scheme IS 'Custom color scheme for fundraiser store: primary, secondary, accent, background, text colors';

-- Display success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Successfully added grid_layout and color_scheme customization options!';
  RAISE NOTICE 'Grid layouts available: compact (6 cols), standard (4 cols), comfortable (3 cols), large (2-3 cols)';
  RAISE NOTICE 'Color presets available: Default, Ocean, Forest, Sunset, Royal, Mono, Mint, Berry';
END $$;
