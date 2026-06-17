import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser } from './_lib/auth';
import { encryptSecret, maskSecret } from './_lib/crypto';
import { getSiteUrl } from './_lib/site';
import { listPrintifyShops, createPrintifyWebhook } from './_lib/printify';
import { listPrintfulStores, createPrintfulWebhook } from './_lib/printful';

type ConnectBody = {
  platform?: string;
  apiKey?: string;
  storeUrl?: string;
  autoSync?: boolean;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);

    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: 'Unauthorized', details: authError });

    const authUserId = String(user?.id || '').trim();
    if (!authUserId) return json(400, { error: 'Missing auth user id' });

    const body = parseJson<ConnectBody>(event.body);
    const platform = String(body?.platform || '').trim().toLowerCase();
    const apiKey = String(body?.apiKey || '').trim();
    const storeUrl = String(body?.storeUrl || '').trim();
    const autoSync = Boolean(body?.autoSync);

    if (!platform) return json(400, { error: 'Missing platform' });
    if (!apiKey) return json(400, { error: 'Missing apiKey' });

    if (!['printify', 'printful'].includes(platform)) {
      return json(400, { error: 'Unsupported platform' });
    }

    const settings: Record<string, any> = { auto_sync: autoSync };
    const siteUrl = getSiteUrl();
    const webhookSecret = String(process.env.PRINTIFY_WEBHOOK_SECRET || '').trim();
    const printfulWebhookSecret = String(process.env.PRINTFUL_WEBHOOK_SECRET || '').trim();

    if (platform === 'printify') {
      const shops = await listPrintifyShops(apiKey);
      if (!shops.length) return json(400, { error: 'No Printify shops found for this API key.' });
      const shop = shops[0];
      settings.shop_id = shop.id;
      settings.shop_name = shop.title || null;
      settings.sales_channel = shop.sales_channel || null;
      if (siteUrl) {
        try {
          const webhookUrl = `${siteUrl.replace(/\/$/, '')}/api/integrations/printify/webhook`;
          await createPrintifyWebhook({
            token: apiKey,
            shopId: shop.id,
            url: webhookUrl,
            secret: webhookSecret || undefined,
          });
          settings.webhook_url = webhookUrl;
        } catch (err: any) {
          settings.webhook_error = err?.message || String(err);
        }
      }
    }

    if (platform === 'printful') {
      const stores = await listPrintfulStores(apiKey);
      if (!stores.length) return json(400, { error: 'No Printful stores found for this API key.' });
      const store = stores[0];
      settings.store_id = store.id;
      settings.store_name = store.name || null;
      if (siteUrl) {
        try {
          const webhookUrl = `${siteUrl.replace(/\/$/, '')}/api/integrations/printful/webhook`;
          await createPrintfulWebhook({
            token: apiKey,
            storeId: store.id,
            url: webhookUrl,
            secret: printfulWebhookSecret || undefined,
          });
          settings.webhook_url = webhookUrl;
        } catch (err: any) {
          settings.webhook_error = err?.message || String(err);
        }
      }
    }

    const encryptedKey = encryptSecret(apiKey);
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .upsert({
        user_id: authUserId,
        platform,
        api_key: encryptedKey,
        store_url: storeUrl || null,
        webhook_url: settings.webhook_url || null,
        is_active: true,
        status: 'active',
        settings,
        connected_at: new Date().toISOString(),
      })
      .select('*')
      .maybeSingle();

    if (error) return json(500, { error: error.message });

    return json(200, {
      ok: true,
      integration: {
        ...data,
        api_key: maskSecret(apiKey),
      },
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
