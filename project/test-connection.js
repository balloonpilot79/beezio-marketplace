import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yemgssttxhkgrivuodbz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbWdzc3R0eGhrZ3JpdnVvZGJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MzQwMjEsImV4cCI6MjA2NzUxMDAyMX0.EyargNCg2m77Tz-JoO5qs6Auxdcd3StvDKx9ZHkKcNM';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔌 Testing Supabase connection...');
console.log('📍 URL:', supabaseUrl);

try {
  // Test basic connection
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  
  if (error) {
    if (error.code === '42P01') {
      console.log('⚠️  Database connected, but tables not found');
      console.log('✅ This means we need to set up the database tables');
      console.log('🚀 Ready to proceed with database setup!');
    } else {
      console.log('❌ Connection error:', error.message);
    }
  } else {
    console.log('✅ Supabase connection successful!');
    console.log('✅ Found', data.length, 'profiles in database');
    console.log('🎉 Database is already set up and working!');
  }
} catch (e) {
  console.log('❌ Test failed:', e.message);
}
