const fs = require('fs');
const path = require('path');

console.log('🔧 Environment File Analysis');
console.log('=============================');

// Read .env file directly
try {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  console.log('✅ .env file found and readable');
  console.log(`📁 Location: ${envPath}`);
  console.log(`📊 File size: ${envContent.length} characters`);
  
  // Parse environment variables
  const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  
  console.log(`\n📋 Found ${lines.length} environment variables:`);
  
  lines.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    
    if (key && value) {
      console.log(`  ✅ ${key}: ${value.substring(0, 20)}...`);
    }
  });
  
  // Validate key formats
  console.log('\n🔍 Validation Results:');
  
  const supabaseUrl = lines.find(line => line.startsWith('VITE_SUPABASE_URL='))?.split('=')[1];
  if (supabaseUrl && supabaseUrl.includes('supabase.co')) {
    console.log('  ✅ Supabase URL format is valid');
  } else {
    console.log('  ❌ Supabase URL format issue');
  }
  
  const stripeKey = lines.find(line => line.startsWith('VITE_STRIPE_PUBLISHABLE_KEY='))?.split('=')[1];
  if (stripeKey && (stripeKey.startsWith('pk_test_') || stripeKey.startsWith('pk_live_'))) {
    console.log('  ✅ Stripe publishable key format is valid');
  } else {
    console.log('  ❌ Stripe publishable key format issue');
  }
  
} catch (error) {
  console.log('❌ Error reading .env file:', error.message);
}

console.log('\n🎉 Analysis complete!');
