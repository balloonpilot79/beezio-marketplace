import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const env = (name: string, fallbacks: string[] = []) => {
  for (const key of [name, ...fallbacks]) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  return '';
};

const normalizeDomain = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

const validDomain = (value: string) =>
  value.length <= 253 && /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);

const aliasesFor = (domain: string | null) => {
  if (!domain) return [];
  const labels = domain.split('.');
  return labels.length === 2 ? [domain, `www.${domain}`] : [domain];
};

const normalizeAlias = (value: unknown) =>
  String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const supabaseUrl = env('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const anonKey = env('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']);
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) return json(503, { error: 'Storefront domain service is not configured.' });

    const authHeader = String(event.headers.authorization || event.headers.Authorization || '').trim();
    if (!authHeader) return json(401, { error: 'Please sign in before changing a custom domain.' });
    const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await authed.auth.getUser();
    const user = userData.user;
    if (!user) return json(401, { error: 'Your session expired. Please sign in again.' });

    const payload = event.body ? JSON.parse(event.body) : {};
    const storefrontId = String(payload.storefront_id || '').trim();
    const requestedDomain = normalizeDomain(payload.domain) || null;
    if (!storefrontId) return json(400, { error: 'Choose a brand storefront first.' });
    if (requestedDomain && !validDomain(requestedDomain)) return json(400, { error: 'Enter a valid domain such as yourbrand.com or shop.yourbrand.com.' });
    if (requestedDomain === 'beezio.co') return json(400, { error: 'That domain is reserved for Beezio.' });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profiles, error: profileError } = await admin
      .from('profiles')
      .select('id,user_id')
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .limit(10);
    if (profileError) return json(500, { error: 'Could not verify storefront ownership.' });
    const profileIds = new Set<string>([user.id]);
    for (const profile of profiles || []) {
      if ((profile as any)?.id) profileIds.add(String((profile as any).id));
    }

    const { data: storefront, error: storefrontError } = await admin
      .from('storefronts')
      .select('id,owner_id,custom_domain')
      .eq('id', storefrontId)
      .maybeSingle();
    if (storefrontError || !storefront) return json(404, { error: 'Brand storefront not found.' });
    if (!profileIds.has(String((storefront as any).owner_id))) return json(403, { error: 'You can only change domains for storefronts you own.' });

    if (requestedDomain) {
      const { data: conflict } = await admin
        .from('storefronts')
        .select('id')
        .eq('custom_domain', requestedDomain)
        .neq('id', storefrontId)
        .limit(1)
        .maybeSingle();
      if (conflict) return json(409, { error: 'That custom domain is already connected to another brand.' });
    }

    const previousDomain = normalizeDomain((storefront as any).custom_domain) || null;
    if (previousDomain === requestedDomain) return json(200, { domain: requestedDomain, unchanged: true });

    const siteId = env('NETLIFY_SITE_ID', ['SITE_ID']);
    const netlifyToken = env('NETLIFY_AUTH_TOKEN', ['NETLIFY_API_TOKEN']);
    if (!siteId || !netlifyToken) {
      return json(503, { error: 'Custom-domain automation needs a one-time Netlify setup. Ask Beezio support to connect the site token.' });
    }

    const netlifyHeaders = { Authorization: `Bearer ${netlifyToken}`, 'Content-Type': 'application/json' };
    const siteResponse = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}`, { headers: netlifyHeaders });
    if (!siteResponse.ok) return json(502, { error: 'Netlify could not load the Beezio site configuration.' });
    const site = await siteResponse.json() as { domain_aliases?: string[] };
    const aliases = new Set((site.domain_aliases || []).map(normalizeAlias).filter(Boolean));
    for (const oldAlias of aliasesFor(previousDomain)) aliases.delete(oldAlias);
    for (const newAlias of aliasesFor(requestedDomain)) aliases.add(newAlias);

    const updateResponse = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}`, {
      method: 'PATCH',
      headers: netlifyHeaders,
      body: JSON.stringify({ domain_aliases: Array.from(aliases).sort() }),
    });
    if (!updateResponse.ok) {
      const details = await updateResponse.text();
      console.error('[storefront-domain-manage] Netlify alias update failed', updateResponse.status, details.slice(0, 500));
      return json(502, { error: 'Netlify could not register that domain. Confirm it is not attached to another Netlify site.' });
    }

    const { error: updateError } = await admin
      .from('storefronts')
      .update({ custom_domain: requestedDomain, updated_at: new Date().toISOString() })
      .eq('id', storefrontId);
    if (updateError) return json(500, { error: 'The domain was registered, but the storefront record could not be updated. Contact support.' });

    return json(200, { domain: requestedDomain, aliases: aliasesFor(requestedDomain) });
  } catch (error) {
    console.error('[storefront-domain-manage]', error);
    return json(500, { error: 'The custom domain could not be updated. Please try again.' });
  }
};
