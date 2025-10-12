// Test Supabase connection and signup functionality
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yemgssttxhkgrivuodbz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzQwMjEsImV4cCI6MjA2NzUxMDAyMX0.EyargNCg2m77Tz-JoO5qs6Auxdcd3StvDKx9ZHkKcNM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseConnection() {
  console.log('Testing Supabase connection...');

  try {
    // Test basic connection
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      console.error('❌ Supabase connection error:', error.message);
      return false;
    }
    console.log('✅ Supabase connection successful');

    // Check if required tables exist
    const tables = ['profiles', 'user_roles', 'categories', 'products'];
    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error(`❌ Table '${table}' error:`, error.message);
        } else {
          console.log(`✅ Table '${table}' exists`);
        }
      } catch (err) {
        console.error(`❌ Table '${table}' check failed:`, err.message);
      }
    }

    // Test signup functionality (create persistent test user for login testing)
    console.log('\nTesting signup flow...');
    const testEmail = `test-login-${Date.now()}@example.com`;
    const testPassword = 'testpassword123';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });

      if (error) {
        console.error('❌ Signup test failed:', error.message);
        return false;
      }

      console.log('✅ Signup test successful');
      console.log('User created with ID:', data.user?.id);
      console.log('Test user email:', testEmail);
      console.log('Test user password:', testPassword);

      // Create profile and role for the test user
      if (data.user) {
        try {
          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              user_id: data.user.id,
              email: testEmail,
              full_name: 'Test User',
              role: 'seller',
              primary_role: 'seller',
              phone: '+1234567890',
              location: 'Test City, Test State',
              zip_code: '12345',
            });

          if (profileError) {
            console.error('❌ Profile creation error:', profileError);
          } else {
            console.log('✅ Profile created for test user');
          }

          // Create user role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: data.user.id,
              role: 'seller',
              is_active: true
            });

          if (roleError) {
            console.error('❌ Role creation error:', roleError);
          } else {
            console.log('✅ Role created for test user (seller)');
          }

        } catch (err) {
          console.error('❌ Error creating profile/role:', err);
        }
      }

      // Don't clean up - keep for login testing
      console.log('ℹ️  Test user kept for login testing');

    } catch (err) {
      console.error('❌ Signup test error:', err.message);
      return false;
    }

    return true;

  } catch (err) {
    console.error('❌ General error:', err.message);
    return false;
  }
}

testSupabaseConnection().then(success => {
  console.log('\n' + (success ? '🎉 All tests passed!' : '❌ Some tests failed'));
  process.exit(success ? 0 : 1);
});