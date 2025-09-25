#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment. Aborting.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

const random = Math.random().toString(36).slice(2, 9);
const email = `test+${random}@example.com`;
const password = `TestPass!${random}`;

async function run() {
  console.log('Testing Supabase auth with', SUPABASE_URL);

  try {
    console.log('Signing up user:', email);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password });
    if (signUpErr) {
      console.error('Sign up error:', signUpErr.message || signUpErr);
    } else {
      console.log('Sign up result:', signUpData?.user ? 'user created' : 'no user/session returned');
    }

    console.log('Signing in user:', email);
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      console.error('Sign in error:', signInErr.message || signInErr);
    } else {
      console.log('Sign in success, session present?', !!signInData?.session);
      if (signInData?.session) {
        console.log('Session user id:', signInData.session.user.id);
      }
    }

    console.log('Fetching current session...');
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      console.error('Get session error:', sessionErr.message || sessionErr);
    } else {
      console.log('Current session user:', session?.user?.email || 'none');
    }

    console.log('Signing out...');
    const { error: signOutErr } = await supabase.auth.signOut();
    if (signOutErr) {
      console.error('Sign out error:', signOutErr.message || signOutErr);
    } else {
      console.log('Signed out successfully');
    }

  } catch (err) {
    console.error('Unexpected error during auth test:', err);
  }
}

run()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
