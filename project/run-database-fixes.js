import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Need service role for DDL
);

console.log('\n🔧 FIXING DATABASE SCHEMA\n');
console.log('═'.repeat(60));

async function runMigration() {
  try {
    const sql = readFileSync(join(__dirname, '..', 'FIX-MISSING-TABLES.sql'), 'utf8');
    
    // Split SQL by statement (simple approach)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`\n📝 Found ${statements.length} SQL statements to execute\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          console.log(`❌ Statement ${i + 1} failed: ${error.message}`);
          console.log(`   SQL: ${statement.substring(0, 100)}...`);
          errorCount++;
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
      } catch (err) {
        console.log(`❌ Statement ${i + 1} exception: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(`\n✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n✅ ALL FIXES APPLIED SUCCESSFULLY!');
    } else {
      console.log('\n⚠️  Some statements failed - check Supabase Dashboard');
    }
    
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
  }
}

// Alternative: Print instructions for manual execution
console.log('⚠️  NOTE: This script requires a custom SQL execution function.');
console.log('Instead, please run the SQL file directly in Supabase Dashboard:\n');
console.log('1. Open Supabase Dashboard');
console.log('2. Go to SQL Editor');
console.log('3. Paste the contents of FIX-MISSING-TABLES.sql');
console.log('4. Click "Run"\n');
console.log('The SQL file is located at:');
console.log(`   ${join(__dirname, '..', 'FIX-MISSING-TABLES.sql')}\n`);
console.log('═'.repeat(60));
console.log('\nPress Ctrl+C to exit, or wait to attempt automated execution...\n');

setTimeout(() => {
  runMigration();
}, 3000);
