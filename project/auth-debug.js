// Debug authentication issues
// Run this in your browser console at https://beezio.co

console.log('=== Beezio Authentication Debug ===');

// Check environment variables
console.log('Environment Variables:');
console.log('- VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('- VITE_SUPABASE_ANON_KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('- VITE_STRIPE_PUBLISHABLE_KEY exists:', !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Check current URL
console.log('Current URL:', window.location.href);
console.log('Current Origin:', window.location.origin);

// Test Supabase connection
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
  console.log('Testing Supabase connection...');
  
  // Test basic connection
  fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    }
  })
  .then(response => {
    console.log('Supabase REST API Status:', response.status);
    if (response.status === 200) {
      console.log('✅ Supabase connection successful');
    } else {
      console.log('❌ Supabase connection failed');
    }
  })
  .catch(error => {
    console.log('❌ Supabase connection error:', error);
  });
  
  // Test auth endpoint
  fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: {
      'apikey': supabaseKey
    }
  })
  .then(response => response.json())
  .then(data => {
    console.log('Supabase Auth Settings:', data);
  })
  .catch(error => {
    console.log('❌ Auth settings error:', error);
  });
} else {
  console.log('❌ Missing Supabase environment variables');
}

console.log('=== End Debug ===');