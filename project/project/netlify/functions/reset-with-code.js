const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async function (event, context) {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const body = JSON.parse(event.body || '{}');
    const { email, code, newPassword } = body;
    if (!email || !code || !newPassword) return { statusCode: 400, body: 'Missing required fields' };

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE) return { statusCode: 500, body: 'Server misconfigured' };

    // Hash provided code for safe comparison (we store hashed codes in DB)
    const hash = crypto.createHash('sha256').update(code).digest('hex');

    // Lookup profile by email via REST
    const base = SUPABASE_URL.replace(/\/$/, '');
    const profilesUrl = `${base}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,recovery_codes`;

    const profilesRes = await fetch(profilesUrl, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` }
    });
    if (!profilesRes.ok) {
      const text = await profilesRes.text();
      return { statusCode: 502, body: `profiles lookup failed: ${profilesRes.status} ${text}` };
    }
    const profiles = await profilesRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile || !profile.id) return { statusCode: 404, body: 'User not found' };

    // Check recovery_codes array for match
    const codes = profile.recovery_codes || [];
    if (!codes.includes(hash)) return { statusCode: 403, body: 'Invalid recovery code' };

    // Find Supabase auth user by email to get user id
    const listUsersUrl = `${base}/auth/v1/admin/users?email=${encodeURIComponent(email)}`;
    const listRes = await fetch(listUsersUrl, { headers: { Authorization: `Bearer ${SERVICE_ROLE}` } });
    if (!listRes.ok) {
      const text = await listRes.text();
      return { statusCode: 502, body: `admin list users failed: ${listRes.status} ${text}` };
    }
    const users = await listRes.json();
    const found = Array.isArray(users) ? users[0] : null;
    if (!found || !found.id) return { statusCode: 404, body: 'Auth user not found' };

    // Update password via admin API
    const patchUrl = `${base}/auth/v1/admin/users/${found.id}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    });
    if (!patchRes.ok) {
      const text = await patchRes.text();
      return { statusCode: 502, body: `admin update password failed: ${patchRes.status} ${text}` };
    }

    // Optionally remove the used code from recovery_codes array
    const removeUrl = `${base}/rest/v1/profiles?id=eq.${encodeURIComponent(profile.id)}`;
    const newCodes = codes.filter(c => c !== hash);
    const removeRes = await fetch(removeUrl, {
      method: 'PATCH',
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recovery_codes: newCodes })
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'Password updated' }) };
  } catch (e) {
    return { statusCode: 500, body: String(e?.message || e) };
  }
};
