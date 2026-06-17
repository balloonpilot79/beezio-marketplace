import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';
import {
  buildAliExpressAuthorizeUrl,
  buildAliExpressState,
  resolveProfileIdFromAccessToken,
} from './_lib/aliexpress';

const redirectResponse = (location: string) => ({
  statusCode: 302,
  headers: {
    Location: location,
    'Cache-Control': 'no-store',
  },
  body: '',
});

export const handler: Handler = async (event) => {
  try {
    const accessToken = String(
      event.queryStringParameters?.access_token ||
        event.queryStringParameters?.token ||
        ''
    ).trim();

    if (!accessToken) {
      return json(401, { error: 'Missing access_token query param' });
    }

    const profileId = await resolveProfileIdFromAccessToken(accessToken);
    const returnTo = String(
      event.queryStringParameters?.return_to ||
        event.queryStringParameters?.returnTo ||
        '/admin/aliexpress-import'
    ).trim();
    const state = buildAliExpressState(profileId, returnTo);
    const authorizeUrl = buildAliExpressAuthorizeUrl(state);

    if (String(event.queryStringParameters?.mode || '').trim().toLowerCase() === 'json') {
      return json(200, { ok: true, authorizeUrl });
    }

    return redirectResponse(authorizeUrl);
  } catch (error: any) {
    return json(500, { error: error?.message || 'Failed to start AliExpress OAuth' });
  }
};

export default handler;
