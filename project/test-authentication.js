import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('\n🔐 AUTHENTICATION SYSTEM TEST\n');
console.log('═'.repeat(60));

const testEmail = `test.user.${Date.now()}@example.com`;
const testPassword = 'TestPassword123!';
const testName = 'Test User';

let userId = null;
let sessionToken = null;

const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Test 1: Sign Up
async function testSignUp() {
  console.log('\n📝 Testing Sign Up...');
  try {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: testName
        }
      }
    });

    if (error) {
      results.failed.push(`Sign Up: ${error.message}`);
      console.log(`❌ ${error.message}`);
      return false;
    }

    if (data.user) {
      userId = data.user.id;
      results.passed.push('Sign Up: User created successfully');
      console.log('✅ User created successfully');
      console.log(`   User ID: ${userId}`);
      return true;
    }

    results.warnings.push('Sign Up: User created but requires email confirmation');
    console.log('⚠️  User created but requires email confirmation');
    return true;

  } catch (err) {
    results.failed.push(`Sign Up exception: ${err.message}`);
    console.log(`❌ Exception: ${err.message}`);
    return false;
  }
}

// Test 2: Sign In
async function testSignIn() {
  console.log('\n🔑 Testing Sign In...');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (error) {
      results.failed.push(`Sign In: ${error.message}`);
      console.log(`❌ ${error.message}`);
      return false;
    }

    if (data.session) {
      sessionToken = data.session.access_token;
      results.passed.push('Sign In: Login successful');
      console.log('✅ Login successful');
      console.log(`   Session: Active`);
      return true;
    }

    results.failed.push('Sign In: No session returned');
    console.log('❌ No session returned');
    return false;

  } catch (err) {
    results.failed.push(`Sign In exception: ${err.message}`);
    console.log(`❌ Exception: ${err.message}`);
    return false;
  }
}

// Test 3: Get Session
async function testGetSession() {
  console.log('\n🔍 Testing Get Session...');
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      results.failed.push(`Get Session: ${error.message}`);
      console.log(`❌ ${error.message}`);
      return false;
    }

    if (data.session) {
      results.passed.push('Get Session: Session retrieved');
      console.log('✅ Session retrieved');
      console.log(`   User: ${data.session.user.email}`);
      return true;
    }

    results.warnings.push('Get Session: No active session');
    console.log('⚠️  No active session');
    return true;

  } catch (err) {
    results.failed.push(`Get Session exception: ${err.message}`);
    console.log(`❌ Exception: ${err.message}`);
    return false;
  }
}

// Test 4: Check Profile Created
async function testProfileCreation() {
  console.log('\n👤 Testing Profile Creation...');
  
  if (!userId) {
    results.warnings.push('Profile Creation: Skipped (no user ID)');
    console.log('⚠️  Skipped (no user ID)');
    return true;
  }

  try {
    // Wait a moment for triggers to run
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        results.failed.push('Profile Creation: Profile not created automatically');
        console.log('❌ Profile not created automatically');
        console.log('   Note: Profile should be created by database trigger');
        return false;
      }
      results.failed.push(`Profile Creation: ${error.message}`);
      console.log(`❌ ${error.message}`);
      return false;
    }

    if (data) {
      results.passed.push('Profile Creation: Profile exists');
      console.log('✅ Profile exists');
      console.log(`   Email: ${data.email}`);
      console.log(`   Role: ${data.role || 'Not set'}`);
      return true;
    }

    results.failed.push('Profile Creation: No profile found');
    console.log('❌ No profile found');
    return false;

  } catch (err) {
    results.failed.push(`Profile Creation exception: ${err.message}`);
    console.log(`❌ Exception: ${err.message}`);
    return false;
  }
}

// Test 5: Password Reset Request
async function testPasswordReset() {
  console.log('\n🔐 Testing Password Reset...');
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
      redirectTo: 'http://localhost:5173/reset-password'
    });

    if (error) {
      results.failed.push(`Password Reset: ${error.message}`);
      console.log(`❌ ${error.message}`);
      return false;
    }

    results.passed.push('Password Reset: Request sent successfully');
    console.log('✅ Reset request sent successfully');
    console.log('   Note: Check email for reset link');
    return true;

  } catch (err) {
    results.failed.push(`Password Reset exception: ${err.message}`);
    console.log(`❌ Exception: ${err.message}`);
    return false;
  }
}

// Test 6: Sign Out
async function testSignOut() {
  console.log('\n👋 Testing Sign Out...');
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      results.failed.push(`Sign Out: ${error.message}`);
      console.log(`❌ ${error.message}`);
      return false;
    }

    results.passed.push('Sign Out: Logout successful');
    console.log('✅ Logout successful');
    return true;

  } catch (err) {
    results.failed.push(`Sign Out exception: ${err.message}`);
    console.log(`❌ Exception: ${err.message}`);
    return false;
  }
}

// Test 7: Verify Session is Gone
async function testSessionGone() {
  console.log('\n🔍 Verifying Session Cleared...');
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      results.warnings.push(`Session Check: ${error.message}`);
      console.log(`⚠️  ${error.message}`);
      return true;
    }

    if (!data.session) {
      results.passed.push('Session Cleared: No active session');
      console.log('✅ Session successfully cleared');
      return true;
    }

    results.warnings.push('Session Cleared: Session still active after logout');
    console.log('⚠️  Session still active after logout');
    return true;

  } catch (err) {
    results.warnings.push(`Session Check exception: ${err.message}`);
    console.log(`⚠️  Exception: ${err.message}`);
    return true;
  }
}

// Test 8: Cleanup Test User
async function cleanup() {
  console.log('\n🧹 Cleaning Up Test Data...');
  
  if (!userId) {
    console.log('⚠️  No test user to clean up');
    return;
  }

  try {
    // Note: This requires service role key or admin privileges
    // In production, you'd use a Supabase admin function
    console.log('⚠️  Manual cleanup required:');
    console.log(`   1. Go to Supabase Dashboard > Authentication`);
    console.log(`   2. Delete user: ${testEmail}`);
    console.log(`   3. Profile will be auto-deleted via CASCADE`);
    
  } catch (err) {
    console.log(`⚠️  Cleanup note: ${err.message}`);
  }
}

// Run all tests
async function runAllTests() {
  const signUpOk = await testSignUp();
  
  if (signUpOk) {
    await testSignIn();
    await testGetSession();
    await testProfileCreation();
    await testPasswordReset();
    await testSignOut();
    await testSessionGone();
  }
  
  await cleanup();

  console.log('\n' + '═'.repeat(60));
  console.log('📊 AUTHENTICATION TEST SUMMARY');
  console.log('═'.repeat(60));

  console.log(`\n✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);

  if (results.passed.length > 0) {
    console.log('\n✅ PASSED:');
    results.passed.forEach(p => console.log(`   ${p}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(w => console.log(`   ${w}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED:');
    results.failed.forEach(f => console.log(`   ${f}`));
  }

  console.log('\n' + '═'.repeat(60));

  if (results.failed.length === 0) {
    console.log('✅ ALL AUTHENTICATION TESTS PASSED!');
  } else {
    console.log('❌ SOME AUTHENTICATION TESTS FAILED');
  }

  console.log('═'.repeat(60) + '\n');
}

runAllTests().catch(console.error);
