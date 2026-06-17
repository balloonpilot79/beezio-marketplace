import type { Handler } from '@netlify/functions';
import { readAliExpressState, exchangeAliExpressCodeForTokens, saveAliExpressTokens } from './_lib/aliexpress';

const redirectResponse = (location: string) => ({
  statusCode: 302,
  headers: {
    Location: location,
    'Cache-Control': 'no-store',
  },
  body: '',
});

export const handler: Handler = async (event) => {
  const code = String(event.queryStringParameters?.code || '').trim();
  const rawState = String(event.queryStringParameters?.state || '').trim();
  const error = String(event.queryStringParameters?.error || '').trim();
  const errorDescription = String(event.queryStringParameters?.error_description || '').trim();

  let returnTo = '/admin/aliexpress-import';

  try {
    if (rawState) {
      const state = readAliExpressState(rawState);
      returnTo = state.returnTo || returnTo;
    }

    if (error) {
      const url = new URL(returnTo, 'https://beezio.local');
      url.searchParams.set('oauth', 'error');
      url.searchParams.set('message', errorDescription || error);
      return redirectResponse(`${url.pathname}${url.search}`);
    }

    if (!code) {
      const url = new URL(returnTo, 'https://beezio.local');
      url.searchParams.set('oauth', 'error');
      url.searchParams.set('message', 'Missing code');
      return redirectResponse(`${url.pathname}${url.search}`);
    }

    const state = readAliExpressState(rawState);
    const tokenPayload = await exchangeAliExpressCodeForTokens(code);
    await saveAliExpressTokens({
      profileId: state.profileId,
      accessToken: tokenPayload.accessToken,
      refreshToken: tokenPayload.refreshToken,
      expiresAt: tokenPayload.expiresAt,
      externalUserId: tokenPayload.externalUserId,
      raw: tokenPayload.raw as Record<string, unknown>,
    });

    const url = new URL(state.returnTo || returnTo, 'https://beezio.local');
    url.searchParams.set('oauth', 'success');
    return redirectResponse(`${url.pathname}${url.search}`);
  } catch (err: any) {
    const url = new URL(returnTo, 'https://beezio.local');
    url.searchParams.set('oauth', 'error');
    url.searchParams.set('message', err?.message || 'AliExpress OAuth failed');
    return redirectResponse(`${url.pathname}${url.search}`);
  }
};

export default handler;
