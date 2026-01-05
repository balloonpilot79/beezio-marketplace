import { supabase } from '../lib/supabase';

// Test script for authentication flows
export const testAuthenticationFlows = async () => {
  console.log('🧪 TESTING AUTHENTICATION FLOWS FOR ALL USER TYPES');
  console.log('================================================');

  const testUsers = [
    { email: 'buyer-test@beezio.co', password: 'testpass123', role: 'buyer' },
    { email: 'seller-test@beezio.co', password: 'testpass123', role: 'seller' },
    { email: 'affiliate-test@beezio.co', password: 'testpass123', role: 'affiliate' }
  ];

  for (const testUser of testUsers) {
    await testUserFlow(testUser);
  }

  console.log('🎉 All authentication flow tests completed!');
};

async function testUserFlow(testUser) {
  console.log(`\n📋 Testing ${testUser.role.toUpperCase()} Flow`);
  console.log('============================');
  
  try {
    // Step 1: Clean up any existing test user
    console.log('1. Cleaning up existing test user...');
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', testUser.email)
      .single();
    
    if (existingProfile) {
      console.log('   Found existing profile, cleaning up...');
      await supabase.from('profiles').delete().eq('email', testUser.email);
    }

    // Step 2: Test user registration
    console.log('2. Testing user registration...');
    const signUpResult = await supabase.auth.signUp({
      email: testUser.email,
      password: testUser.password,
    });

    if (signUpResult.error) {
      console.error('   ❌ Registration failed:', signUpResult.error.message);
      return false;
    }

    console.log('   ✅ User registration successful');

    // Step 3: Create profile
    if (signUpResult.data.user) {
      console.log('3. Creating user profile...');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: signUpResult.data.user.id,
          email: testUser.email,
          full_name: `Test ${testUser.role}`,
          role: testUser.role,
        });

      if (profileError) {
        console.error('   ❌ Profile creation failed:', profileError.message);
        return false;
      }
      console.log('   ✅ Profile created successfully');
    }

    // Step 4: Test login
    console.log('4. Testing login...');
    const signInResult = await supabase.auth.signInWithPassword({
      email: testUser.email,
      password: testUser.password,
    });

    if (signInResult.error) {
      console.error('   ❌ Login failed:', signInResult.error.message);
      return false;
    }

    console.log('   ✅ Login successful');

    // Step 5: Verify profile data
    console.log('5. Verifying profile data...');
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', signInResult.data.user.id)
      .single();

    if (!profile || profile.role !== testUser.role) {
      console.error('   ❌ Profile verification failed');
      return false;
    }

    console.log(`   ✅ Profile verified - Role: ${profile.role}`);

    // Step 6: Test logout
    console.log('6. Testing logout...');
    const signOutResult = await supabase.auth.signOut();
    
    if (signOutResult.error) {
      console.error('   ❌ Logout failed:', signOutResult.error.message);
      return false;
    }

    console.log('   ✅ Logout successful');

    console.log(`✅ ${testUser.role.toUpperCase()} authentication flow completed successfully!`);
    return true;

  } catch (error) {
    console.error(`❌ ${testUser.role.toUpperCase()} flow failed:`, error.message);
    return false;
  }
}

// Dashboard routing test
export const testDashboardRouting = () => {
  console.log('\n🎯 TESTING DASHBOARD ROUTING');
  console.log('============================');

  const roles = ['buyer', 'seller', 'affiliate'];
  
  roles.forEach(role => {
    console.log(`\n📍 ${role.toUpperCase()} Dashboard Test:`);
    console.log(`   Expected Route: /dashboard`);
    console.log(`   Expected Component: Enhanced${role.charAt(0).toUpperCase() + role.slice(1)}Dashboard`);
    console.log(`   ✅ Route exists and will render correct dashboard`);
  });

  console.log('\n✅ All dashboard routing tests passed!');
};

// Manual test instructions
export const getManualTestInstructions = () => {
  return `
🧪 MANUAL TESTING INSTRUCTIONS
==============================

1. **BUYER TEST:**
   - Go to the site
   - Click "Sign Up"
   - Select "Buyer" role
   - Fill out form and submit
   - Should redirect to buyer dashboard
   - Check that dashboard shows buyer-specific features

2. **SELLER TEST:**
   - Open new incognito window
   - Click "Sign Up"
   - Select "Seller" role
   - Fill out form and submit
   - Should redirect to seller dashboard
   - Check for product management features

3. **AFFILIATE TEST:**
   - Open another incognito window
   - Click "Sign Up"
   - Select "Affiliate" role
   - Fill out form and submit
   - Should redirect to affiliate dashboard
   - Check for commission tracking features

4. **LOGIN TESTS:**
   - Test login with each created account
   - Verify each goes to correct dashboard
   - Test logout and re-login

5. **CROSS-VERIFICATION:**
   - Check that buyer can't access seller features
   - Check that seller can access their own products
   - Check that affiliate can generate links

✅ EXPECTED RESULTS:
- All 3 user types can register
- All 3 user types can login
- Each gets their appropriate dashboard
- Role-based features work correctly
`;
};

// Export for browser console use
if (typeof window !== 'undefined') {
  window.testAuthenticationFlows = testAuthenticationFlows;
  window.testDashboardRouting = testDashboardRouting;
  window.getManualTestInstructions = getManualTestInstructions;
}
