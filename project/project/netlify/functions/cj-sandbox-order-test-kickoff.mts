import type { Config } from '@netlify/functions';

export default async () => {
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const siteUrl = String(process.env.URL || 'https://beezio.co').replace(/\/$/, '');

  if (!serviceRoleKey) {
    console.error('CJ sandbox kickoff skipped: SUPABASE_SERVICE_ROLE_KEY is missing.');
    return;
  }

  const response = await fetch(`${siteUrl}/.netlify/functions/cj-sandbox-order-test-v2-background`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (response.status !== 202) {
    const body = await response.text().catch(() => '');
    console.error('CJ sandbox-v2 background kickoff failed:', response.status, body.slice(0, 300));
  } else {
    console.log('CJ state-aware sandbox verification background run accepted.');
  }
};

export const config: Config = {
  schedule: '*/15 * * * *',
};
