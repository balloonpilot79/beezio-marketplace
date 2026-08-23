export default async () => {
  if (String(process.env.CJ_CATALOG_AUTOMATION_ENABLED || '').trim().toLowerCase() !== 'true') {
    console.log('CJ catalog seeding is disabled. Set CJ_CATALOG_AUTOMATION_ENABLED=true to re-enable it intentionally.');
    return;
  }

  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const siteUrl = String(process.env.URL || 'https://beezio.co').replace(/\/$/, '');

  if (!serviceRoleKey) {
    console.error('CJ price-tier seed kickoff skipped: SUPABASE_SERVICE_ROLE_KEY is missing.');
    return;
  }

  const response = await fetch(`${siteUrl}/.netlify/functions/cj-seed-tiers-v2-background`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (response.status !== 202) {
    const body = await response.text().catch(() => '');
    console.error('CJ tier-v2 background kickoff failed:', response.status, body.slice(0, 300));
  } else {
    console.log('CJ corrected price-tier seed accepted.');
  }
};
