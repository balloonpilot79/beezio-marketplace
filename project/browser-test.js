// Simple Browser Console Test
// Copy and paste this into your browser console at beezio.co

(async function testMigration() {
  console.log('🔍 TESTING DATABASE MIGRATION...\n');
  
  // Get Supabase client (try different ways it might be available)
  let supabase;
  try {
    // Try to get from window object
    supabase = window.supabase;
    
    // If not available, try to import
    if (!supabase) {
      const module = await import('./src/lib/supabase.js');
      supabase = module.supabase;
    }
  } catch (error) {
    console.log('❌ Could not access Supabase client');
    console.log('Make sure you are on beezio.co or localhost with the app running');
    return;
  }

  if (!supabase) {
    console.log('❌ Supabase not available. Make sure you\'re on the correct site.');
    return;
  }

  console.log('✅ Supabase client found, testing migration...\n');

  // Test 1: user_roles table
  console.log('TEST 1: user_roles table');
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);
    
    if (error && error.message.includes('relation "public.user_roles" does not exist')) {
      console.log('❌ FAILED: user_roles table not created');
      console.log('💡 Please re-run the SQL migration in Supabase dashboard');
      return false;
    } else {
      console.log('✅ PASSED: user_roles table exists');
    }
  } catch (err) {
    console.log('❌ ERROR testing user_roles:', err.message);
    return false;
  }

  // Test 2: primary_role column
  console.log('\nTEST 2: primary_role column in profiles');
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, role, primary_role')
      .limit(1);
    
    if (error && error.message.includes('column "primary_role" does not exist')) {
      console.log('❌ FAILED: primary_role column not added');
      console.log('💡 Please re-run the ALTER TABLE part of the SQL migration');
      return false;
    } else {
      console.log('✅ PASSED: primary_role column exists');
    }
  } catch (err) {
    console.log('❌ ERROR testing primary_role:', err.message);
    return false;
  }

  // Success!
  console.log('\n🎉 SUCCESS: Database migration completed successfully!');
  console.log('✅ user_roles table created');
  console.log('✅ primary_role column added to profiles');
  console.log('✅ Ready to deploy the multi-role system!');
  
  return true;
})();
