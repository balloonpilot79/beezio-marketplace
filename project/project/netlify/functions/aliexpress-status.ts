import type { Handler } from '@netlify/functions';
import { extractAuthHeader, getAuthedUser, resolveProfileId } from './_lib/auth';
import { json } from './_lib/http';
import { getAliExpressIntegration, summarizeAliExpressIntegration } from './_lib/aliexpress';

export const handler: Handler = async (event) => {
  try {
    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: error || 'Unauthorized' });

    const profileId = await resolveProfileId(user);
    if (!profileId) return json(400, { error: 'Missing profile id' });

    const integration = await getAliExpressIntegration(profileId);
    return json(200, {
      ok: true,
      integration: summarizeAliExpressIntegration(integration),
    });
  } catch (err: any) {
    return json(500, { error: err?.message || 'Failed to load AliExpress status' });
  }
};

export default handler;
