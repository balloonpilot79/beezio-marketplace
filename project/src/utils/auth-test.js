import { supabase } from '../lib/supabase';

// Test authentication flow
export const testAuthFlow = async () => {
  console.log('🧪 Testing Authentication Flow');
  console.log('================================');

  try {
    // Test 1: Check if we can connect to Supabase Auth
    console.log('1. Testing Supabase connection...');
    const { data: { session } } = await supabase.auth.getSession();
    console.log('   ✅ Supabase Auth connection working');
    console.log('   Current session:', session ? 'Logged in' : 'Not logged in');

    // Test 2: Try to get user profiles (this will tell us if tables exist)
    console.log('2. Testing database tables...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error && error.code === '42P01') {
      console.log('   ⚠️  Tables not found - database setup needed');
      console.log('   Error:', error.message);
      return { needsSetup: true, error: 'Database tables not found' };
    } else if (error) {
      console.log('   ❌ Database error:', error.message);
      return { needsSetup: false, error: error.message };
    } else {
      console.log('   ✅ Database tables exist');
    }

    // Test 3: Check if sign up is working
    console.log('3. Testing user registration capabilities...');
    // Just check the function exists, don't actually create a user
    if (typeof supabase.auth.signUp === 'function') {
      console.log('   ✅ Sign up function available');
    }

    // Test 4: Check authentication settings
    console.log('4. Checking authentication configuration...');
    console.log('   Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('   Auth configured:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);

    return { needsSetup: false, error: null };

  } catch (err) {
    console.log('   ❌ Test failed:', err.message);
    return { needsSetup: true, error: err.message };
  }
};

// Function to test login with specific credentials
export const testLogin = async (email: string, password: string) => {
  console.log('🔐 Testing Login Credentials');
  console.log('============================');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('❌ Login failed:', error.message);
      
      if (error.message.includes('Invalid login credentials')) {
        console.log('💡 This usually means:');
        console.log('   1. User doesn\'t exist in the database');
        console.log('   2. Wrong email/password combination');
        console.log('   3. User hasn\'t confirmed their email');
      }
      
      return { success: false, error: error.message };
    }

    console.log('✅ Login successful!');
    return { success: true, user: data.user };

  } catch (err) {
    console.log('❌ Login test error:', err.message);
    return { success: false, error: err.message };
  }
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testAuthFlow = testAuthFlow;
  window.testLogin = testLogin;
}
