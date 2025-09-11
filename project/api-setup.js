import fetch from 'node-fetch';

console.log('🚀 Direct API Database Setup...');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql })
    });
    
    const result = await response.json();
    return { success: response.ok, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function quickSetup() {
  console.log('📋 Setting up basic tables...');
  
  const basicSQL = `
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      email TEXT UNIQUE,
      full_name TEXT,
      role TEXT DEFAULT 'buyer'
    );
  `;
  
  const result = await executeSQL(basicSQL);
  console.log('✅ Result:', result);
}

async function setupLinkedAccountsAndProducts() {
  console.log('📋 Setting up linked accounts and imported products tables...');

  const sql = `
    CREATE TABLE IF NOT EXISTS linked_accounts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES profiles(id),
      platform TEXT NOT NULL,
      account_details JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS imported_products (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES profiles(id),
      product_data JSONB,
      source TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  const result = await executeSQL(sql);
  console.log('✅ Linked accounts and imported products setup result:', result);
}

quickSetup();
setupLinkedAccountsAndProducts();
