import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'your-supabase-key';
const supabase = createClient(supabaseUrl, supabaseKey);

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
