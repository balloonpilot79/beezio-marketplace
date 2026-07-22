import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { assertPost, json, parseJson } from './_lib/http';
import { importProductUrl } from './_lib/productUrlImporter';

type Body = { url?: string };

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event as any);
    const body = parseJson<Body>(event.body);
    const url = String(body?.url || '').trim();
    if (!url) return json(400, { ok: false, error: 'Enter a supplier product URL.' });
    const product = await importProductUrl(url);
    return json(200, { ok: true, product });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 400;
    return json(statusCode, { ok: false, error: error instanceof Error ? error.message : 'Unable to import this product URL.' });
  }
};

export default handler;
