// Simple database migration test
const { createClient } = require('@supabase/supabase-js');

// Use environment variables for Supabase configuration. Do not hardcode keys in source.
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMigration() {
  console.log('🔍 Testing Multi-Role Database Migration...\n');

  // Test 1: user_roles table
  console.log('1️⃣ Testing user_roles table...');
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log('❌ user_roles table error:', error.message);
      if (error.message.includes('relation "public.user_roles" does not exist')) {
        console.log('💡 The user_roles table was not created. Please check your SQL execution.');
        return false;
      }
    } else {
      console.log('✅ user_roles table exists!');
    }
  } catch (err) {
    console.log('❌ user_roles test failed:', err.message);
  }

  // Test 2: profiles primary_role column
  console.log('\n2️⃣ Testing profiles.primary_role column...');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, role, primary_role')
      .limit(1);
    
    if (error) {
      console.log('❌ profiles.primary_role error:', error.message);
      if (error.message.includes('column "primary_role" does not exist')) {
        console.log('💡 The primary_role column was not added. Please check your SQL execution.');
        return false;
      }
    } else {
      console.log('✅ profiles.primary_role column exists!');
    }
  } catch (err) {
    console.log('❌ profiles test failed:', err.message);
  }

  console.log('\n🎉 Database migration test completed!');
  console.log('If you see ✅ for both tests, the migration was successful.');
  return true;
}

testMigration().catch(console.error);
