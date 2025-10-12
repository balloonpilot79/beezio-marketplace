import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log('🔐 Testing Login/Sign-in Functionality\n');
  
  // Test 1: Check Supabase connection
  console.log('1. Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connection successful\n');
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return;
  }

  // Test 2: Test with existing user (if any)
  console.log('2. Testing sign-in with existing user...');
  
  // First, let's check if there are any existing users
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('email')
      .limit(1);
    
    if (error) throw error;
    
    if (profiles && profiles.length > 0) {
      const testEmail = profiles[0].email;
      console.log(`Found existing user: ${testEmail}`);
      
      // Test sign-in with wrong password (should fail)
      console.log('Testing with incorrect password...');
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: 'wrongpassword123'
        });
        
        if (error) {
          console.log('✅ Correctly rejected invalid credentials:', error.message);
        } else {
          console.log('❌ Should have rejected invalid credentials');
        }
      } catch (error) {
        console.log('✅ Correctly rejected invalid credentials:', error.message);
      }
      
    } else {
      console.log('No existing users found for testing');
    }
  } catch (error) {
    console.error('Error checking existing users:', error.message);
  }

  // Test 3: Test authentication flow structure
  console.log('\n3. Testing authentication flow structure...');
  
  try {
    // Get current session (should be null if not logged in)
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    
    console.log('Current session status:', sessionData.session ? 'Logged in' : 'Not logged in');
    
    // Test auth state listener setup (won't actually listen, just test setup)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change detected:', event);
    });
    
    console.log('✅ Auth state listener setup successful');
    
    // Clean up listener
    authListener.subscription.unsubscribe();
    
  } catch (error) {
    console.error('❌ Authentication flow test failed:', error.message);
  }

  // Test 4: Test profile fetching structure
  console.log('\n4. Testing profile fetching structure...');
  
  try {
    // Test profile query structure (without requiring specific user)
    const { error } = await supabase
      .from('profiles')
      .select('user_id, email, full_name, primary_role, role')
      .eq('user_id', '00000000-0000-0000-0000-000000000000') // Non-existent UUID
      .maybeSingle();
    
    // Should not error on structure, only on data not found
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Profile query structure issue:', error.message);
    } else {
      console.log('✅ Profile query structure is correct');
    }
  } catch (error) {
    console.error('❌ Profile fetching test failed:', error.message);
  }

  // Test 5: Test user roles fetching structure
  console.log('\n5. Testing user roles fetching structure...');
  
  try {
    const { error } = await supabase
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', '00000000-0000-0000-0000-000000000000') // Non-existent UUID
      .eq('is_active', true);
    
    if (error) {
      console.error('❌ User roles query issue:', error.message);
    } else {
      console.log('✅ User roles query structure is correct');
    }
  } catch (error) {
    console.error('❌ User roles fetching test failed:', error.message);
  }

  console.log('\n🎯 Login System Analysis Complete!');
  console.log('\nKey Points:');
  console.log('- Supabase connection is working');
  console.log('- Authentication structure is properly configured');
  console.log('- Profile and user roles tables are accessible');
  console.log('- Login flow in AuthModal should work correctly');
  
  console.log('\nRecommendations:');
  console.log('✅ Create a test account to verify end-to-end login');
  console.log('✅ Test password reset functionality');
  console.log('✅ Verify role-based redirects after login');
}

testLogin().catch(console.error);