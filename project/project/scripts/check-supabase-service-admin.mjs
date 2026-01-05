import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

async function run() {
  try {
    const base = SUPABASE_URL.replace(/\/$/, '');
    const url = `${base}/auth/v1/admin/users?per_page=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${SERVICE_ROLE}` } });
    if (!res.ok) {
      const text = await res.text();
      console.error('Admin API check failed:', res.status, res.statusText, text.substring(0, 200));
      process.exit(2);
    }
    const data = await res.json();
    console.log('Admin API check succeeded. sample users returned:', Array.isArray(data) ? data.length : 0);
    process.exit(0);
  } catch (e) {
    console.error('Admin API check error:', e?.message || e);
    process.exit(3);
  }
}

run();
