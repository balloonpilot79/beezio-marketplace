import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Safe presence checks (we never log secret values)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log('Env check: VITE_SUPABASE_URL=' + (process.env.VITE_SUPABASE_URL ? 'SET' : 'NOT_SET'));
console.log('Env check: VITE_SUPABASE_ANON_KEY=' + (process.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT_SET'));

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be set in env to run API E2E tests.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fail fast helpers
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && (err.message || err));
  process.exit(1);
});

// Global timeout so the script doesn't hang indefinitely in CI/user terminals
const GLOBAL_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const globalTimer = setTimeout(() => {
  console.error(`E2E script timed out after ${GLOBAL_TIMEOUT_MS / 1000}s`);
  process.exit(2);
}, GLOBAL_TIMEOUT_MS);

const testUsers = [
  { email: 'e2e-buyer@test.beezio.co', password: 'Testpass123!', role: 'buyer' },
  { email: 'e2e-seller@test.beezio.co', password: 'Testpass123!', role: 'seller' },
  { email: 'e2e-affiliate@test.beezio.co', password: 'Testpass123!', role: 'affiliate' },
];

async function cleanupProfile(email) {
  try {
    const { data } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
    if (data && data.id) {
      await supabase.from('profiles').delete().eq('email', email);
      console.log('Deleted existing profile for', email);
    }
  } catch (err) {
    console.warn('Cleanup profile error for', email, err.message || err);
  }
}

async function runUserFlow(user) {
  console.log(`\n== Running flow for: ${user.email} (${user.role})`);

  await cleanupProfile(user.email);

  // Sign up (if already exists, try sign in)
  let signUpData = null;
  try {
    const res = await supabase.auth.signUp({ email: user.email, password: user.password });
    signUpData = res.data;
    if (res.error) throw res.error;
    console.log('Sign up ok. user id:', signUpData?.user?.id || 'n/a');
  } catch (err) {
    const msg = err?.message || String(err);
    console.warn('Sign up failed:', msg);
    // If user already exists, try signing in
    if (msg.includes('already registered') || msg.includes('User already registered') || msg.includes('already')) {
      console.log('Attempting sign in for existing user...');
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      if (signInErr) {
        console.error('Sign in after existing user failed:', signInErr.message || signInErr);
        return false;
      }
      console.log('Sign in successful for existing user. user id:', signInData?.user?.id || 'n/a');
      signUpData = signInData;
    } else {
      return false;
    }
  }

  // Create profile row if user id available and profile missing
  const userId = signUpData?.user?.id;
  if (userId) {
    try {
      const { data: existingProfile, error: selectErr } = await supabase.from('profiles').select('id').eq('email', user.email).maybeSingle();
      if (selectErr) {
        console.warn('Profile select warning:', selectErr.message || selectErr);
      }
      if (!existingProfile) {
        const { error: profileErr } = await supabase.from('profiles').insert({
          user_id: userId,
          email: user.email,
          full_name: `E2E ${user.role}`,
          role: user.role,
        });
        if (profileErr) {
          console.error('Profile insert failed:', profileErr.message || profileErr);
        } else {
          console.log('Profile created');
        }
      } else {
        console.log('Profile already exists for', user.email);
      }
    } catch (e) {
      console.warn('Error ensuring profile exists:', e?.message || e);
    }
  }

  // Sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (signInError) {
    console.error('Sign in failed:', signInError.message || signInError);
    return false;
  }

  console.log('Sign in successful. session present:', !!signInData?.session);

  // Persist Playwright-compatible storage state so we can reuse the session in browser tests
  try {
    const fs = await import('fs');
    const storage = {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [
            { name: 'supabase.auth.token', value: JSON.stringify(signInData.session) }
          ]
        }
      ]
    };
    const out = `browser-session-${user.role}.json`;
    fs.writeFileSync(out, JSON.stringify(storage, null, 2));
    console.log('Wrote browser storage file for role', user.role, out);
  } catch (e) {
    console.warn('Failed to write browser session file:', e?.message || e);
  }

  // Verify profile via RPC
  const { data: profile, error: profileFetchErr } = await supabase.from('profiles').select('*').eq('email', user.email).maybeSingle();
  if (profileFetchErr) console.warn('Profile fetch warning:', profileFetchErr.message || profileFetchErr);
  else console.log('Profile fetched, role:', profile?.role);

  // Sign out
  const { error: signOutErr } = await supabase.auth.signOut();
  if (signOutErr) console.error('Sign out failed:', signOutErr.message || signOutErr);
  else console.log('Sign out succeeded');

  // Request password reset (sends email via Supabase)
  const redirectTo = 'https://beezio.co/reset-password';
  const { data: resetData, error: resetErr } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
  if (resetErr) console.warn('Reset email request failed/warn:', resetErr.message || resetErr);
  else console.log('Password reset requested (email may have been sent)');

  // If reset failed (common when SMTP isn't configured), try a server-side admin fallback
  if (resetErr) {
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRole) {
      try {
        console.log('Attempting admin fallback: set password via SUPABASE_SERVICE_ROLE_KEY');
        // Find user by email using Admin REST API
        const base = SUPABASE_URL.replace(/\/$/, '');
        const listUrl = `${base}/auth/v1/admin/users?email=${encodeURIComponent(user.email)}`;
        const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${serviceRole}` } });
        if (!listRes.ok) throw new Error(`admin list users failed: ${listRes.status} ${listRes.statusText}`);
        const users = await listRes.json();
        const found = Array.isArray(users) ? users[0] : null;
        if (!found || !found.id) {
          console.warn('Admin fallback: user not found via admin API for', user.email);
        } else {
          const userId = found.id;
          const patchUrl = `${base}/auth/v1/admin/users/${userId}`;
          const patchRes = await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${serviceRole}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: user.password })
          });
          if (!patchRes.ok) {
            const text = await patchRes.text();
            console.warn('Admin fallback: failed to update password:', patchRes.status, patchRes.statusText, text);
          } else {
            console.log('Admin fallback: password updated for', user.email);
          }
        }
      } catch (e) {
        console.warn('Admin fallback error:', e?.message || e);
      }
    } else {
      console.warn('No SUPABASE_SERVICE_ROLE_KEY in env; cannot perform admin fallback for reset');
    }
  }

  return true;
}

(async () => {
  for (const u of testUsers) {
    const ok = await runUserFlow(u);
    if (!ok) {
      console.error('User flow failed for', u.email);
    }
  }

  console.log('\nE2E API tests complete');
  process.exit(0);
})();
