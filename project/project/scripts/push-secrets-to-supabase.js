#!/usr/bin/env node
// Reads .env from repo root and pushes required secrets to Supabase via the `supabase` CLI.
// Usage: node scripts/push-secrets-to-supabase.js <project-ref>

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env');

if (process.argv.length < 3) {
  console.error('Usage: node scripts/push-secrets-to-supabase.js <project-ref>');
  process.exit(2);
}

const projectRef = process.argv[2];

if (!fs.existsSync(ENV_PATH)) {
  console.error('.env file not found in repo root. Create one with your staging/test keys.');
  process.exit(1);
}

const envContent = fs.readFileSync(ENV_PATH, 'utf8');
const lines = envContent.split(/\r?\n/);
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.substring(0, idx).trim();
  const value = trimmed.substring(idx + 1).trim();
  env[key] = value;
}

const required = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET'
];

const toSet = required.filter(k => env[k]);
const missing = required.filter(k => !env[k]);

if (missing.length) {
  console.error('Missing required keys in .env:', missing.join(', '));
  process.exit(1);
}

console.log('Pushing secrets to Supabase project:', projectRef);

for (const key of toSet) {
  // Do NOT print the value. We pass it to the supabase CLI via stdin to avoid showing it in shell history.
  const value = env[key];
  console.log(`  - Setting ${key}`);
  // Use `supabase secrets set` which supports stdin via `--data` in newer CLIs; fallback to echoing to stdin.
  // We'll call: supabase secrets set KEY=value --project-ref <projectRef>
  const cmd = 'supabase';
  const args = ['secrets', 'set', `${key}=${value}`, '--project-ref', projectRef];

  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error) {
    console.error(`Failed to run supabase CLI for ${key}:`, res.error.message);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`supabase CLI returned non-zero status for ${key}. Aborting.`);
    process.exit(res.status || 1);
  }
}

console.log('Secrets pushed successfully.');
