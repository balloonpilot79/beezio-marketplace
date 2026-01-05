import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run(email) {
  try {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://beezio.co/reset-password' });
    if (error) {
      console.error('resetPasswordForEmail error:', error.message || error);
      if (error.status) console.error('status:', error.status);
      process.exit(2);
    }
    console.log('resetPasswordForEmail OK', JSON.stringify(data));
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error:', e?.message || e);
    process.exit(3);
  }
}

const email = process.argv[2] || 'e2e-buyer@test.beezio.co';
run(email);
