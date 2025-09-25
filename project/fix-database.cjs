const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function runMigrations() {
  console.log('🚀 Running critical database migrations...');

  try {
    // Create store_settings table
    console.log('📋 Creating store_settings table...');
    const storeSettingsSQL = `
CREATE TABLE IF NOT EXISTS store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_name TEXT,
  store_description TEXT,
  store_banner TEXT,
  store_logo TEXT,
  store_theme TEXT DEFAULT 'modern',
  custom_domain TEXT,
  social_links JSONB DEFAULT '{}',
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
`;

    const { error: storeError } = await supabase.rpc('exec_sql', { sql: storeSettingsSQL });
    if (storeError) {
      console.log('RPC method failed, trying direct SQL execution...');
      // Try direct approach if RPC doesn't work
      console.log('Please run the SQL manually in Supabase dashboard or use the migration files');
      console.log('Migration file: supabase/migrations/20250729000001_store_settings.sql');
    } else {
      console.log('✅ store_settings table created');
    }

    // Create affiliate_store_settings table
    console.log('📋 Creating affiliate_store_settings table...');
    const affiliateStoreSQL = `
CREATE TABLE IF NOT EXISTS affiliate_store_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT,
  store_description TEXT,
  store_banner TEXT,
  store_logo TEXT,
  store_theme TEXT DEFAULT 'vibrant',
  personal_message TEXT,
  social_links JSONB DEFAULT '{}',
  favorite_categories TEXT[] DEFAULT '{}',
  commission_goal DECIMAL(10,2) DEFAULT 0,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(affiliate_id)
);

-- RLS policies for affiliate_store_settings
ALTER TABLE affiliate_store_settings ENABLE ROW LEVEL SECURITY;

-- Affiliates can view their own store settings and public view for everyone
CREATE POLICY "Affiliates can view their own store" ON affiliate_store_settings
  FOR SELECT
  USING (auth.uid() = affiliate_id OR true);

-- Affiliates can insert their own store settings
CREATE POLICY "Affiliates can create their store" ON affiliate_store_settings
  FOR INSERT
  WITH CHECK (auth.uid() = affiliate_id);

-- Affiliates can update their own store settings
CREATE POLICY "Affiliates can update their store" ON affiliate_store_settings
  FOR UPDATE
  USING (auth.uid() = affiliate_id)
  WITH CHECK (auth.uid() = affiliate_id);

-- Affiliates can delete their own store settings
CREATE POLICY "Affiliates can delete their store" ON affiliate_store_settings
  FOR DELETE
  USING (auth.uid() = affiliate_id);
`;

    const { error: affiliateError } = await supabase.rpc('exec_sql', { sql: affiliateStoreSQL });
    if (affiliateError) {
      console.log('RPC method failed for affiliate table too');
      console.log('Please run the SQL manually in Supabase dashboard');
    } else {
      console.log('✅ affiliate_store_settings table created');
    }

    console.log('🎉 Database migration script completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('🔧 Manual SQL execution needed. Run these files in Supabase:');
    console.log('   - supabase/migrations/20250729000001_store_settings.sql');
    console.log('   - AFFILIATE_STORE_SETUP.sql (for affiliate stores)');
  }
}

runMigrations();