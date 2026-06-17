#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

for (const file of ['.env.local', '.env']) {
  const full = path.join(process.cwd(), file);
  if (fs.existsSync(full)) dotenv.config({ path: full, override: false });
}

const BASE_URL = String(process.env.GO_LIVE_BASE_URL || 'https://beezio.co').replace(/\/$/, '');
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SERVICE_ROLE = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function deterministicFromProfileId(profileId) {
  return `BZO${String(profileId || '').replace(/-/g, '').toUpperCase()}`;
}

async function getSampleProfile() {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in local env');
  }

  const url = `${SUPABASE_URL}/rest/v1/profiles?select=id,referral_code&referral_code=not.is.null&order=updated_at.desc.nullslast,id.asc&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });
  const rows = await res.json().catch(() => []);
  if (!res.ok) {
    throw new Error(`Supabase profile probe failed (${res.status})`);
  }
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No profile with referral_code found for E2E probe');
  }
  return rows[0];
}

async function main() {
  const sample = await getSampleProfile();
  const profileId = String(sample.id || '').trim();
  const referralCode = String(sample.referral_code || '').trim();
  if (!profileId || !referralCode) {
    throw new Error('Sample profile missing id or referral_code');
  }

  const deterministicCode = deterministicFromProfileId(profileId);

  const byReferral = await fetchJson(`${BASE_URL}/api/public/recruit/resolve?code=${encodeURIComponent(referralCode)}`);
  const byDeterministic = await fetchJson(`${BASE_URL}/api/public/recruit/resolve?code=${encodeURIComponent(deterministicCode)}`);

  console.log(`base=${BASE_URL}`);
  console.log(`sample_profile_id=${profileId}`);
  console.log(`sample_referral_code=${referralCode}`);
  console.log(`deterministic_code=${deterministicCode}`);
  console.log(`resolve_by_referral_code=${JSON.stringify(byReferral.body)}`);
  console.log(`resolve_by_deterministic_code=${JSON.stringify(byDeterministic.body)}`);

  if (!(byReferral.ok && byReferral.body && byReferral.body.ok === true && byReferral.body.valid === true)) {
    throw new Error('E2E failed: resolver did not validate existing referral_code');
  }

  console.log('E2E PASS: resolver validates real signup code.');
}

main().catch((err) => {
  console.error(`E2E FAILED: ${err.message || err}`);
  process.exit(1);
});
