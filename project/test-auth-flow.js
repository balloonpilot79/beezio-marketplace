/**
 * Authentication Flow Test Script
 * Tests sign-up and sign-in functionality
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔐 Testing Authentication Flow\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey.substring(0, 20) + '...\n');

async function testAuthFlow() {
  const testEmail = `test-${Date.now()}@beezio.test`;
  const testPassword = 'TestPassword123!';
  
  console.log('1️⃣ Testing Sign-Up');
  console.log('   Email:', testEmail);
  console.log('   Password:', testPassword);
  
  try {
    // Test sign-up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    });
    
    if (signUpError) {
      console.error('   ❌ Sign-up error:', signUpError.message);
      return false;
    }
    
    if (!signUpData.user) {
      console.error('   ❌ No user returned from sign-up');
      return false;
    }
    
    console.log('   ✅ Sign-up successful');
    console.log('   User ID:', signUpData.user.id);
    console.log('   Session:', signUpData.session ? 'Created' : 'Email confirmation required');
    
    // Wait a moment for the database trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if profile was created by trigger
    console.log('\n2️⃣ Checking Profile Creation');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', signUpData.user.id)
      .maybeSingle();
    
    if (profileError) {
      console.error('   ❌ Profile check error:', profileError.message);
    } else if (profileData) {
      console.log('   ✅ Profile exists (created by trigger)');
      console.log('   Profile ID:', profileData.id);
      console.log('   Role:', profileData.role);
    } else {
      console.log('   ⚠️  No profile found - will be created by app on first login');
    }
    
    // If we have a session, test sign-out and sign-in
    if (signUpData.session) {
      console.log('\n3️⃣ Testing Sign-Out');
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        console.error('   ❌ Sign-out error:', signOutError.message);
      } else {
        console.log('   ✅ Sign-out successful');
      }
      
      console.log('\n4️⃣ Testing Sign-In');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      
      if (signInError) {
        console.error('   ❌ Sign-in error:', signInError.message);
        return false;
      }
      
      if (!signInData.user || !signInData.session) {
        console.error('   ❌ No user/session returned from sign-in');
        return false;
      }
      
      console.log('   ✅ Sign-in successful');
      console.log('   User ID:', signInData.user.id);
      console.log('   Session valid until:', new Date(signInData.session.expires_at * 1000).toLocaleString());
      
      // Test profile access with authenticated session
      console.log('\n5️⃣ Testing Profile Access with Auth');
      const { data: authProfileData, error: authProfileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', signInData.user.id)
        .single();
      
      if (authProfileError) {
        console.error('   ❌ Profile access error:', authProfileError.message);
      } else if (authProfileData) {
        console.log('   ✅ Profile accessible');
        console.log('   Email:', authProfileData.email);
        console.log('   Role:', authProfileData.role);
        console.log('   Primary Role:', authProfileData.primary_role);
      } else {
        console.log('   ⚠️  No profile found');
      }
      
      // Clean up - sign out
      await supabase.auth.signOut();
    } else {
      console.log('\n⚠️  Email confirmation required - skipping sign-in test');
      console.log('   In production, user would need to click email confirmation link');
    }
    
    console.log('\n✅ Authentication flow test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    return false;
  }
}

async function testExistingUser() {
  console.log('\n6️⃣ Testing Sign-In with Existing User');
  console.log('   Email: jason@beezio.co');
  
  try {
    // Try to sign in with known user (will fail if password is wrong, which is expected)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'jason@beezio.co',
      password: 'incorrect-password-test',
    });
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        console.log('   ✅ Auth validation working (rejected bad password)');
      } else {
        console.log('   ℹ️  Error:', error.message);
      }
    } else if (data.user) {
      console.log('   ⚠️  Unexpected: logged in with test password');
      await supabase.auth.signOut();
    }
    
    // Check if profile exists
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, primary_role')
      .eq('email', 'jason@beezio.co')
      .maybeSingle();
    
    if (profileError) {
      console.error('   ❌ Profile check error:', profileError.message);
    } else if (profileData) {
      console.log('   ✅ Profile exists in database');
      console.log('   Profile ID:', profileData.id);
      console.log('   Name:', profileData.full_name);
      console.log('   Role:', profileData.role);
      console.log('   Primary Role:', profileData.primary_role);
    } else {
      console.log('   ⚠️  No profile found for jason@beezio.co');
    }
    
  } catch (error) {
    console.error('   ❌ Unexpected error:', error);
  }
}

async function checkSupabaseConfig() {
  console.log('\n🔍 Checking Supabase Configuration\n');
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Database connection error:', error.message);
      console.error('   This could indicate RLS policies blocking access');
      return false;
    }
    
    console.log('✅ Database connection successful');
    
    // Check if auth is enabled
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('✅ Auth API accessible');
    console.log('   Current session:', sessionData.session ? 'Active' : 'None');
    
    return true;
  } catch (error) {
    console.error('❌ Configuration check failed:', error);
    return false;
  }
}

// Run tests
(async () => {
  const configOk = await checkSupabaseConfig();
  
  if (!configOk) {
    console.log('\n⚠️  Configuration issues detected. Fix these before testing auth flow.');
    process.exit(1);
  }
  
  await testAuthFlow();
  await testExistingUser();
  
  console.log('\n' + '='.repeat(60));
  console.log('Test completed!');
  console.log('='.repeat(60));
})();
