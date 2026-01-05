import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Netlify Functions use CJ_API_KEY (no VITE_ prefix).
// Never use VITE_CJ_API_KEY here because that encourages putting secrets into the client build env.
const CJ_API_KEY = String(process.env.CJ_API_KEY || '')
  .trim()
  // Handle common "quoted in env var" mistakes
  .replace(/^"(.*)"$/, '$1')
  .replace(/^'(.*)'$/, '$1')
  .trim();
const CJ_API_BASE_URL = (process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1').replace(/\/$/, '');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// In-memory token cache (resets on cold starts, which is fine since tokens last 15 days)
let cachedAccessToken: string | null = null;
let tokenExpiryMs: number | null = null;
let tokenFetchedAtMs: number | null = null;
let tokenFetchInFlight: Promise<string> | null = null;

// CJ rate limiting: enforce a minimum spacing between outgoing CJ requests per function instance.
// CJ can rate-limit aggressively (e.g. QPS limit 1). Multiple UI actions can trigger concurrent invocations.
// Defaults are conservative because CJ can enforce strict global QPS (often 1 QPS).
const CJ_MIN_REQUEST_INTERVAL_MS = Number(process.env.CJ_MIN_REQUEST_INTERVAL_MS || 2000);
const CJ_429_BACKOFF_MS = Number(process.env.CJ_429_BACKOFF_MS || 5 * 60_000);
const CJ_INVALID_KEY_COOLDOWN_MS = Number(process.env.CJ_INVALID_KEY_COOLDOWN_MS || 60_000);
let lastCJRequestAtMs = 0;
let lastCJ429AtMs = 0;
let lastCJInvalidKeyAtMs = 0;
let cjRequestQueue: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskKey(key: string): string {
  if (!key) return '(missing)';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

class CJInvalidApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CJInvalidApiKeyError';
  }
}

async function enqueueCJRequest<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    if (lastCJInvalidKeyAtMs > 0) {
      const remaining = CJ_INVALID_KEY_COOLDOWN_MS - (Date.now() - lastCJInvalidKeyAtMs);
      if (remaining > 0) {
        throw new Error('CJ API key rejected recently. Please verify CJ_API_KEY in Netlify and retry shortly.');
      }
    }

    if (lastCJ429AtMs > 0) {
      const backoffRemaining = CJ_429_BACKOFF_MS - (Date.now() - lastCJ429AtMs);
      if (backoffRemaining > 0) {
        await sleep(backoffRemaining);
      }
    }

    const now = Date.now();
    const elapsed = now - lastCJRequestAtMs;
    const waitMs = Math.max(0, CJ_MIN_REQUEST_INTERVAL_MS - elapsed);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    lastCJRequestAtMs = Date.now();
    return task();
  };

  // Keep the queue moving even if a prior task failed.
  const chained = cjRequestQueue.catch(() => undefined).then(run);
  cjRequestQueue = chained.then(() => undefined, () => undefined);
  return chained;
}

/**
 * Get or refresh CJ access token
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedAccessToken) {
    const now = Date.now();

    // Prefer server-provided expiry when parseable; otherwise fall back to an assumed 14-day TTL from fetch time.
    const assumedExpiryMs =
      typeof tokenFetchedAtMs === 'number' ? tokenFetchedAtMs + 14 * 24 * 60 * 60 * 1000 : null;
    const effectiveExpiryMs = tokenExpiryMs ?? assumedExpiryMs;

    if (typeof effectiveExpiryMs === 'number' && Number.isFinite(effectiveExpiryMs) && effectiveExpiryMs > now + 60_000) {
      console.log('Using cached access token');
      return cachedAccessToken;
    }

    // If we couldn't determine expiry, still try using the cached token rather than hammering auth.
    if (effectiveExpiryMs == null) {
      console.log('Using cached access token (expiry unknown)');
      return cachedAccessToken;
    }
  }

  // De-dupe concurrent token refresh attempts (e.g. categories + products loading at the same time).
  if (tokenFetchInFlight) {
    return tokenFetchInFlight;
  }

  // If a previous request failed due to rate limiting, wait before retrying
  if (globalThis.lastCJTokenError && Date.now() - globalThis.lastCJTokenError < CJ_429_BACKOFF_MS) {
    throw new Error('CJ API rate limit hit. Please wait before retrying.');
  }

  // Get new access token
  tokenFetchInFlight = (async () => {
    // First try persistent token cache (helps across Netlify cold starts).
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('cj_tokens')
          .select('access_token, expires_at')
          .eq('id', 1)
          .maybeSingle();

        if (!error && data?.access_token) {
          const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : NaN;
          if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now() + 60_000) {
            cachedAccessToken = data.access_token;
            tokenExpiryMs = expiresAtMs;
            tokenFetchedAtMs = Date.now();
            console.log('Using persistent CJ access token cache');
            return cachedAccessToken;
          }
        }
      } catch (e) {
        console.warn('CJ token cache read failed (continuing):', e instanceof Error ? e.message : e);
      }
    }

    console.log('Fetching new access token from CJ');
    const response = await enqueueCJRequest(() =>
      fetch(`${CJ_API_BASE_URL}/authentication/getAccessToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey: CJ_API_KEY
        })
      })
    );

    const data = await response.json();

    if (response.status === 429) {
      lastCJ429AtMs = Date.now();
      globalThis.lastCJTokenError = Date.now();
      console.error('CJ API rate limit (429 Too Many Requests)');
      throw new Error('CJ API rate limit (429 Too Many Requests): QPS limit is 1. Please wait and try again.');
    }

    if (!response.ok || !data.result) {
      console.error('Failed to get access token:', { status: response.status, data });
      const message = String(data?.message || '');
      if (/apikey\s+is\s+wrong/i.test(message)) {
        lastCJInvalidKeyAtMs = Date.now();
        console.error('CJ rejected API key:', { masked: maskKey(CJ_API_KEY), length: CJ_API_KEY.length });
        throw new CJInvalidApiKeyError(`Failed to get CJ access token (${response.status}): ${data.message || 'API key rejected'}`);
      }
      throw new Error(`Failed to get CJ access token (${response.status}): ${data.message || 'Unknown error'}`);
    }

    cachedAccessToken = data.data.accessToken;
    tokenFetchedAtMs = Date.now();

    const rawExpiry = data.data.accessTokenExpiryDate;
    let parsedExpiry: number | null = null;
    if (typeof rawExpiry === 'number' && Number.isFinite(rawExpiry)) {
      parsedExpiry = rawExpiry > 1e12 ? rawExpiry : rawExpiry * 1000;
    } else if (typeof rawExpiry === 'string') {
      const trimmed = rawExpiry.trim();
      if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        parsedExpiry = n > 1e12 ? n : n * 1000;
      } else {
        const dt = new Date(trimmed).getTime();
        parsedExpiry = Number.isFinite(dt) ? dt : null;
      }
    }
    tokenExpiryMs = parsedExpiry;

    console.log('Got new access token, expires:', tokenExpiryMs ?? rawExpiry);
    if (!cachedAccessToken) {
      throw new Error('CJ access token was missing in response');
    }

    // Write through to persistent cache (best-effort).
    if (supabaseAdmin) {
      try {
        const expiresAt = tokenExpiryMs ? new Date(tokenExpiryMs).toISOString() : null;
        await supabaseAdmin
          .from('cj_tokens')
          .upsert(
            { id: 1, access_token: cachedAccessToken, expires_at: expiresAt },
            { onConflict: 'id' }
          );
      } catch (e) {
        console.warn('CJ token cache write failed (continuing):', e instanceof Error ? e.message : e);
      }
    }

    return cachedAccessToken;
  })();

  try {
    return await tokenFetchInFlight;
  } finally {
    tokenFetchInFlight = null;
  }
}

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get the endpoint and method from the request body
    const { endpoint, body: requestBody, method = 'POST' } = JSON.parse(event.body || '{}');

    if (!endpoint) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'Endpoint is required' })
      };
    }

    if (!CJ_API_KEY) {
      console.error('CJ_API_KEY not found in environment');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'CJ API key not configured' })
      };
    }

    console.log('CJ proxy env:', { hasApiKey: true, apiKeyMasked: maskKey(CJ_API_KEY), apiKeyLength: CJ_API_KEY.length, baseUrl: CJ_API_BASE_URL });

    // Get access token
    let accessToken: string;
    try {
      accessToken = await getAccessToken();
    } catch (tokenError) {
      // If rate limit error, return 429
      if (tokenError instanceof Error && tokenError.message.includes('rate limit')) {
        const retryAfterSeconds = Math.max(1, Math.ceil(CJ_429_BACKOFF_MS / 1000));
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Retry-After': String(retryAfterSeconds),
          },
          body: JSON.stringify({ error: tokenError.message })
        };
      }
      if (tokenError instanceof Error && tokenError.message.includes('CJ API key rejected recently')) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
          body: JSON.stringify({ error: tokenError.message })
        };
      }
      if (tokenError instanceof CJInvalidApiKeyError) {
        return {
          statusCode: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
          body: JSON.stringify({
            error: 'CJ API key rejected by CJ',
            details: tokenError.message,
            apiKeyMasked: maskKey(CJ_API_KEY),
            apiKeyLength: CJ_API_KEY.length,
            baseUrl: CJ_API_BASE_URL,
          })
        };
      }
      throw tokenError;
    }

    // Build URL with query params for GET requests
    let url = `${CJ_API_BASE_URL}/${endpoint}`;
    const fetchOptions: RequestInit = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'cj-access-token': accessToken
      }
    };

    if (method === 'GET' && requestBody && Object.keys(requestBody).length > 0) {
      // Convert body to query params for GET requests
      const params = new URLSearchParams();
      Object.entries(requestBody).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      url += `?${params.toString()}`;
    } else if (method === 'POST') {
      // Include body for POST requests
      fetchOptions.body = JSON.stringify(requestBody || {});
    }

    console.log('CJ API Request:', { url, method, endpoint, hasToken: !!accessToken });

    // Make request to CJ API with access token (rate-limited per function instance)
    const response = await enqueueCJRequest(() => fetch(url, fetchOptions));
    if (response.status === 429) {
      lastCJ429AtMs = Date.now();
    }

    const raw = await response.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!data) {
      const snippet = raw?.slice(0, 500)?.replace(/\s+/g, ' ') || '';
      console.log('CJ API Response was non-JSON:', { status: response.status, ok: response.ok, snippet });
      return {
        statusCode: response.ok ? 200 : response.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({
          result: false,
          message: 'CJ returned non-JSON response',
          status: response.status,
          snippet
        })
      };
    }

    console.log('CJ API Response:', { status: response.status, ok: response.ok, success: data.result, message: data.message });

    return {
      statusCode: response.ok ? 200 : response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('CJ Proxy Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to fetch from CJ API',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
