import type { Config } from '@netlify/functions';

export default async () => {
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const siteUrl = String(process.env.URL || 'https://beezio.co').replace(/\/$/, '');

  if (!serviceRoleKey) {
    console.error('CJ live audit kickoff skipped: SUPABASE_SERVICE_ROLE_KEY is missing.');
    return;
  }

  const response = await fetch(`${siteUrl}/.netlify/functions/cj-live-audit-background`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (response.status !== 202) {
    const body = await response.text().catch(() => '');
    console.error('CJ live audit kickoff failed:', response.status, body.slice(0, 300));
  }
};

export const config: Config = {
  // Seed runs at :00/:15/:30/:45. Offset audits so both workers do not hammer
  // CJ's 1 request/second account limit at the same time.
  schedule: '5,10,20,25,35,40,50,55 * * * *',
};
