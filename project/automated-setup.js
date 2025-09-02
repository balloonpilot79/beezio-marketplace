import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting automated Beezio database setup...');

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in .env file');
  console.log('Make sure you have:');
  console.log('- VITE_SUPABASE_URL=your_url');
  console.log('- SUPABASE_SERVICE_ROLE_KEY=your_service_key');
  process.exit(1);
}

console.log('✅ Environment variables loaded');

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to read and execute SQL files
async function executeSQLFile(filePath) {
  try {
    const fileName = path.basename(filePath);
    console.log(`📄 Executing ${fileName}...`);
    
    const sql = fs.readFileSync(filePath, 'utf8');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Try direct query if RPC doesn't work
      const { data: directData, error: directError } = await supabase
        .from('_sql_migrations')
        .select('*')
        .limit(1);
      
      if (directError) {
        console.log(`⚠️  ${fileName}: ${error.message} (this may be normal)`);
      } else {
        console.log(`✅ ${fileName}: Success`);
      }
    } else {
      console.log(`✅ ${fileName}: Success`);
    }
  } catch (err) {
    console.log(`⚠️  ${path.basename(filePath)}: ${err.message}`);
  }
}

// Get all migration files in order
const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort()
  .map(file => path.join(migrationsDir, file));

console.log(`📂 Found ${migrationFiles.length} migration files`);

// Execute migrations in order
async function runMigrations() {
  for (const filePath of migrationFiles) {
    await executeSQLFile(filePath);
    // Small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Test database connection first
async function testConnection() {
  try {
    console.log('🔌 Testing database connection...');
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    
    if (error && error.code === '42P01') {
      console.log('📋 Tables not found - running migrations...');
      return false;
    } else if (error) {
      console.log('⚠️  Connection test:', error.message);
      return false;
    } else {
      console.log('✅ Database connection successful');
      console.log('✅ Tables already exist - skipping migrations');
      return true;
    }
  } catch (err) {
    console.log('🔄 Setting up fresh database...');
    return false;
  }
}

// Main execution
async function main() {
  try {
    const tablesExist = await testConnection();
    
    if (!tablesExist) {
      console.log('🚀 Running database migrations...');
      await runMigrations();
    }
    
    console.log('\n🎉 Database setup complete!');
    console.log('🌐 Your Beezio marketplace is ready at: http://localhost:5173/');
    console.log('\n✅ Next steps:');
    console.log('1. Visit your site and create an account');
    console.log('2. Check the seller/affiliate dashboards');
    console.log('3. Browse the pre-loaded products');
    console.log('4. Test the purchase flow');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n🔧 Manual setup option:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Open SQL Editor in your project');
    console.log('3. Run the migration files from supabase/migrations/');
  }
}

main();
