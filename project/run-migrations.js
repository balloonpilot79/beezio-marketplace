import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase URL or service role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runMigrations() {
  console.log('🔧 Running database migrations...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'corrected_beezio_setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split into individual statements (basic split on semicolon)
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim().startsWith('--') || statement.trim() === '') continue;

      console.log(`Executing: ${statement.trim().substring(0, 50)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.error(`❌ Error executing statement:`, error.message);
        console.error(`Statement:`, statement);
        // Continue with other statements
      } else {
        console.log('✅ Statement executed successfully');
      }
    }

    console.log('\n🎉 Migrations completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

runMigrations();