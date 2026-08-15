import type { Config } from '@netlify/functions';

export default async () => {
  const siteUrl = String(process.env.URL || 'https://beezio.co').replace(/\/$/, '');
  const response = await fetch(`${siteUrl}/.netlify/functions/supliful-catalog-seed-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (response.status !== 202) {
    console.error('Supliful catalog sync kickoff failed:', response.status);
  }
};

export const config: Config = {
  schedule: '15 * * * *',
};