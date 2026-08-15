import type { Config } from '@netlify/functions';

export default async () => {
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

  if (!serviceRoleKey || !supabaseUrl) {
    console.error('CJ video cleanup skipped: Supabase configuration is missing.');
    return;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/cleanup-cj-video-cache`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('CJ video cleanup failed:', response.status, body.slice(0, 300));
  } else {
    const body = await response.text().catch(() => '');
    console.log('CJ video cleanup complete:', body.slice(0, 300));
  }
};

export const config: Config = {
  // CJ catalog seed runs every 15 minutes. Cleanup shortly after each cycle.
  schedule: '12,27,42,57 * * * *',
};
