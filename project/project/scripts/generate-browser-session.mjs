import 'dotenv/config';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_* equivalents) in env');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const resolveStorageKey = (supabaseUrl) => {
  try {
    const host = new URL(supabaseUrl).host;
    const projectRef = host.split('.')[0] || '';
    return projectRef ? `sb-${projectRef}-auth-token` : 'supabase.auth.token';
  } catch {
    return 'supabase.auth.token';
  }
};

async function run() {
  const role = process.argv[2] || 'buyer';
  const email = process.argv[3] || `e2e-${role}@test.beezio.co`;
  const pw = process.argv[4] || 'Testpass123!';
  const origin = process.argv[5] || 'http://localhost:5173';
  const storageKey = resolveStorageKey(SUPABASE_URL);

  console.log('Signing in', email);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
  if (error) {
    console.error('Sign in error:', error.message || error);
    process.exit(3);
  }

  if (!data || !data.session) {
    console.error('No session returned from signIn');
    process.exit(4);
  }

  const session = data.session;
  // Playwright storageState format: { cookies: [...], origins: [...] }
  // Supabase v2 persists sessions under sb-<project-ref>-auth-token.
  const storage = {
    cookies: [],
    origins: [
      {
        origin,
        localStorage: [
          { name: storageKey, value: JSON.stringify(session) }
        ]
      }
    ]
  };

  const out = `browser-session-${role}.json`;
  fs.writeFileSync(out, JSON.stringify(storage, null, 2));
  console.log('Wrote', out);
}

run();
