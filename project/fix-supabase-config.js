#!/usr/bin/env node

console.log('🔧 SUPABASE CONFIGURATION HELPER');
console.log('================================');

const currentUrl = 'http://localhost:5173';

console.log('\n📋 TO FIX "PAGE NOT FOUND" ERRORS:');
console.log('==================================');

console.log('\n1. 🌐 GO TO SUPABASE DASHBOARD:');
console.log('   https://supabase.com/dashboard');

console.log('\n2. 🔑 OPEN YOUR PROJECT:');
console.log('   Project: yemgssttxhkgrivuodbz');

console.log('\n3. ⚙️  GO TO AUTHENTICATION > SETTINGS:');
console.log('   Click on "Authentication" in the sidebar');
console.log('   Then click "Settings" tab');

console.log('\n4. 🏠 SET SITE URL:');
console.log('   Site URL: ' + currentUrl);
console.log('   (This is where users get redirected after email actions)');

console.log('\n5. 🔗 ADD REDIRECT URLs:');
console.log('   Additional Redirect URLs:');
console.log('   • ' + currentUrl + '/**');
console.log('   • ' + currentUrl + '/reset-password');
console.log('   • ' + currentUrl + '/dashboard');

console.log('\n6. 📧 CHECK EMAIL TEMPLATES:');
console.log('   Go to Authentication > Email Templates');
console.log('   For "Reset Password" template, ensure it uses:');
console.log('   {{ .SiteURL }}/reset-password?token={{ .TokenHash }}');

console.log('\n7. 💾 SAVE CHANGES');
console.log('   Click "Save" button');

console.log('\n8. 🧪 TEST AFTER CHANGES:');
console.log('   • Clear browser cache/cookies');
console.log('   • Try password reset again');
console.log('   • Check that email links point to localhost:5173');

console.log('\n⚠️  COMMON ISSUES:');
console.log('==================');
console.log('• Email links still point to old domain (beezio.co)');
console.log('• Site URL not set to localhost for development');
console.log('• Redirect URLs too restrictive');
console.log('• Browser cache containing old URLs');

console.log('\n🎯 QUICK TEST:');
console.log('==============');
console.log('After making changes:');
console.log('1. Request password reset');
console.log('2. Check email - link should be: localhost:5173/reset-password?...');
console.log('3. Click link - should load reset password page');

console.log('\n✅ SUCCESS INDICATORS:');
console.log('======================');
console.log('• Email links point to localhost:5173');
console.log('• Reset password page loads without "page not found"');
console.log('• Can successfully update password');

console.log('\n📱 FOR PRODUCTION LATER:');
console.log('========================');
console.log('Change Site URL to your production domain');
console.log('Example: https://your-domain.com');
