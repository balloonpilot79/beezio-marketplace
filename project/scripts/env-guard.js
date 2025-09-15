#!/usr/bin/env node
// Ensure developer doesn't accidentally build with missing critical env values.
const fs = require('fs');
const path = require('path');

const envFileCandidates = [
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '.env.local')
];
const envFile = envFileCandidates.find(f => fs.existsSync(f));
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY'
];

if (!envFile) {
  console.warn('No .env or .env.local file found in project root. Skipping runtime env validation.');
  process.exit(0);
}

const content = fs.readFileSync(envFile, 'utf8');
const map = {};
for (const line of content.split(/\r?\n/)) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) map[m[1].trim()] = m[2].trim();
}

const missing = required.filter(k => !map[k]);
if (missing.length) {
  console.error('Missing required env vars in .env:', missing.join(', '));
  console.error('Add them to .env or set them in your CI provider.');
  process.exit(1);
}

console.log('Env guard: required keys present.');
