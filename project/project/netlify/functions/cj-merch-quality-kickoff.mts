export default async () => {
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const siteUrl = String(process.env.URL || 'https://beezio.co').replace(/\/$/, '');
  if (!serviceRoleKey) return;

  const response = await fetch(`${siteUrl}/.netlify/functions/cj-merch-quality-background`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (response.status !== 202) {
    console.error('CJ merchandising quality kickoff failed:', response.status);
  }
};
