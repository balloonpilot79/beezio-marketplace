import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
} as const;

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: defaultHeaders,
    body: JSON.stringify(body),
  };
}

function requireEnv(name: string, fallbacks: string[] = []): string {
  const keys = [name, ...fallbacks];
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) return value;
  }
  throw new Error(`Missing ${name}${fallbacks.length ? ` (or ${fallbacks.join(', ')})` : ''}`);
}

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return json(200, {});
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const query = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};
    const productId = String(query.productId || (body as any)?.productId || '').trim();

    if (!productId) return json(400, { error: 'productId is required' });

    const supabaseUrl = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseAdmin
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) return json(500, { error: error.message });

    return json(200, { variants: Array.isArray(data) ? data : [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load variants';
    return json(500, { error: message });
  }
};

export { handler };
