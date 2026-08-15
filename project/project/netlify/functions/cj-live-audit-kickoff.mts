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
  // Catalog seed: :00/:15/:30/:45. Price policy: :10/:40.
  // Audit at clean slots between both workers to respect CJ's account-wide
  // 1 request/second limit and avoid false QPS failures.
  schedule: '5,20,35,50 * * * *',
};
