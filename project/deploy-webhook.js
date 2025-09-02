import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the webhook function
const webhookPath = path.join(__dirname, 'supabase', 'functions', 'stripe-webhook', 'index.ts');
const webhookCode = fs.readFileSync(webhookPath, 'utf8');

console.log('🚀 Deploying Stripe webhook function to Supabase...');
console.log('\n📋 Function code ready for manual deployment:');
console.log('━'.repeat(50));
console.log('Function name: stripe-webhook');
console.log('━'.repeat(50));
console.log('\n📝 Copy this code to the Supabase Functions editor:');
console.log('\n' + webhookCode);
console.log('\n━'.repeat(50));
console.log('\n✅ Next steps:');
console.log('1. Go to: https://supabase.com/dashboard/project/yemgssttxhkgrivuodbz/functions');
console.log('2. Click "Create a new function"');
console.log('3. Name it: stripe-webhook');
console.log('4. Paste the code above');
console.log('5. Click "Deploy"');
console.log('\n🔧 Environment variables needed in Supabase:');
console.log('- STRIPE_SECRET_KEY: sk_test_51RmQ5ZGfNVbOuQlVrm4lGAkUCGQGpCkLY6QpMAxVnxBp2bBoOyfN4mtAutwFbq6euflLVEHAEuonxu8HsD5RQx3A00t1pumSi8');
console.log('- STRIPE_WEBHOOK_SECRET: whsec_DYc9WHi4N8pSkFpu8Yw4ggIRmeuZ0zLd');
console.log('- SUPABASE_URL: https://yemgssttxhkgrivuodbz.supabase.co');
console.log('- SUPABASE_SERVICE_ROLE_KEY: (your service role key)');
