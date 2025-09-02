import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://yemgssttxhkgrivuodbz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzQwMjEsImV4cCI6MjA2NzUxMDAyMX0.EyargNCg2m77Tz-JoO5qs6Auxdcd3StvDKx9ZHkKcNM');

async function checkUserRoles() {
  try {
    const { data, error } = await supabase.from('user_roles').select('*').limit(1);
    if (error) {
      console.log('❌ user_roles table not found - migration needed');
      console.log('Error:', error.message);
    } else {
      console.log('✅ user_roles table exists - migration completed');
      console.log('Sample data:', data);
    }
  } catch (e) {
    console.log('❌ Test failed:', e.message);
  }
}

checkUserRoles();
