import type { Handler } from '@netlify/functions';
import { extractAuthHeader, getAuthedUser, resolveProfileId } from './_lib/auth';
import { json, parseJson } from './_lib/http';
import { callAliExpressApi } from './_lib/aliexpress';

type TestBody = {
  method?: string;
  productId?: string;
  shipToCountry?: string;
  targetCurrency?: string;
};

export const handler: Handler = async (event) => {
  try {
    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: error || 'Unauthorized' });

    const profileId = await resolveProfileId(user);
    if (!profileId) return json(400, { error: 'Missing profile id' });

    const body = parseJson<TestBody>(event.body);
    const method = String(body?.method || process.env.ALIEXPRESS_TEST_METHOD || 'aliexpress.ds.product.get').trim();
    const apiParams: Record<string, unknown> = {};
    const productId = String(body?.productId || '').trim();

    if (productId) apiParams.product_id = productId;
    if (String(body?.shipToCountry || '').trim()) apiParams.ship_to_country = String(body?.shipToCountry).trim();
    if (String(body?.targetCurrency || '').trim()) apiParams.target_currency = String(body?.targetCurrency).trim();

    const payload = await callAliExpressApi({
      profileId,
      method,
      apiParams,
    });

    return json(200, {
      ok: true,
      method,
      payload,
    });
  } catch (err: any) {
    return json(500, { error: err?.message || 'AliExpress API test failed' });
  }
};

export default handler;
