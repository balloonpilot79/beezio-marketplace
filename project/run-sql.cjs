/**
 * Run SQL files directly from terminal
 * Usage: node run-sql.js <filename.sql>
 * Example: node run-sql.js FIX-PRODUCTS-TABLE-FOR-CJ.sql
 */

const fs = require('fs');
const path = require('path');

// Get SQL file from command line
const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error('❌ Error: Please provide a SQL file');
  console.log('Usage: node run-sql.js <filename.sql>');
  console.log('Example: node run-sql.js FIX-PRODUCTS-TABLE-FOR-CJ.sql');
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(sqlFile)) {
  console.error(`❌ Error: File "${sqlFile}" not found`);
  process.exit(1);
}

// Read SQL file
const sql = fs.readFileSync(sqlFile, 'utf8');

console.log('📄 Reading SQL file:', sqlFile);
console.log('📏 SQL length:', sql.length, 'characters');
console.log('');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.log('Please ensure these are in your .env file:');
  console.log('  - VITE_SUPABASE_URL');
  console.log('  - VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

console.log('🔌 Connecting to Supabase...');
console.log('📍 URL:', supabaseUrl);
console.log('');

// Execute SQL using Supabase REST API
const executeSql = async () => {
  try {
    // Split SQL into statements (basic split on semicolons outside strings)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log('📋 Found', statements.length, 'SQL statements');
    console.log('');

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip tiny statements
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      console.log('   ', statement.substring(0, 80) + (statement.length > 80 ? '...' : ''));

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ query: statement + ';' })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`   ❌ Error:`, error);
        console.log('');
        continue;
      }

      const result = await response.json();
      console.log(`   ✅ Success`);
      if (result && Array.isArray(result) && result.length > 0) {
        console.log(`   📊 Returned ${result.length} rows`);
      }
      console.log('');
    }

    console.log('');
    console.log('✅ SQL execution complete!');
    console.log('');

  } catch (error) {
    console.error('❌ Error executing SQL:', error.message);
    process.exit(1);
  }
};

// Alternative method: Use postgres client directly
const executeWithPostgres = async () => {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' }
  });

  console.log('🚀 Executing SQL...');
  console.log('');

  try {
    // Try to execute the entire SQL as one block
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Error:', error.message);
      console.log('');
      console.log('Trying alternative method: executing statement by statement...');
      console.log('');
      
      // Fall back to statement-by-statement execution
      await executeSql();
    } else {
      console.log('✅ SQL executed successfully!');
      if (data) {
        console.log('📊 Result:', JSON.stringify(data, null, 2));
      }
      console.log('');
    }
  } catch (err) {
    console.error('❌ Execution error:', err.message);
    console.log('');
    console.log('🔄 Trying alternative method...');
    console.log('');
    await executeSql();
  }
};

// Run it
executeWithPostgres().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
