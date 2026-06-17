import crypto from 'crypto';
import { createSupabaseAdmin, createSupabaseAuthed } from './supabase';
import { buildAuthHeader, resolveAuthUserIdFromProfileId } from './auth';
import { decryptSecret, encryptSecret, maskSecret } from './crypto';

const AUTHORIZE_URL = 'https://oauth.aliexpress.com/authorize';
const TOKEN_URL = 'https://oauth.aliexpress.com/token';
const API_URL = 'https://api-sg.aliexpress.com/sync';
const PLATFORM = 'aliexpress';
const STATE_TTL_MS = 10 * 60 * 1000;

type AliExpressTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  expire_time?: number | string;
  ali_user_id?: string | number;
  user_id?: string | number;
  error?: string;
  error_description?: string;
  [key: string]: unknown;
};

type AliExpressStatePayload = {
  profileId: string;
  returnTo: string;
  ts: number;
};

type AliExpressStoredIntegration = {
  id: string;
  user_id: string;
  platform: string;
  api_key: string | null;
  settings: Record<string, unknown> | null;
  is_active?: boolean | null;
  status: string | null;
  connected_at: string | null;
  last_sync: string | null;
};

function requireEnv(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getAliExpressAppKey() {
  return requireEnv('ALIEXPRESS_APP_KEY');
}

export function getAliExpressAppSecret() {
  return requireEnv('ALIEXPRESS_APP_SECRET');
}

export function getAliExpressRedirectUri() {
  return requireEnv('ALIEXPRESS_REDIRECT_URI');
}

export function getAliExpressAuthorizeUrl() {
  return String(process.env.ALIEXPRESS_AUTHORIZE_URL || AUTHORIZE_URL).trim() || AUTHORIZE_URL;
}

export function getAliExpressTokenUrl() {
  return String(process.env.ALIEXPRESS_TOKEN_URL || TOKEN_URL).trim() || TOKEN_URL;
}

export function getAliExpressApiUrl() {
  return String(process.env.ALIEXPRESS_API_URL || API_URL).trim() || API_URL;
}

function getStateSecret() {
  return String(
    process.env.ALIEXPRESS_OAUTH_STATE_SECRET ||
      process.env.INTEGRATIONS_ENCRYPTION_KEY ||
      process.env.ALIEXPRESS_APP_SECRET ||
      ''
  ).trim();
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signStatePayload(payload: string) {
  const secret = getStateSecret();
  if (!secret) throw new Error('Missing ALIEXPRESS_OAUTH_STATE_SECRET or INTEGRATIONS_ENCRYPTION_KEY');
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
}

export function buildAliExpressState(profileId: string, returnTo: string) {
  const payload = base64UrlEncode(
    JSON.stringify({
      profileId,
      returnTo: returnTo || '/admin/aliexpress-import',
      ts: Date.now(),
    } satisfies AliExpressStatePayload)
  );
  const signature = signStatePayload(payload);
  return `${payload}.${signature}`;
}

export function readAliExpressState(rawState: string | null | undefined): AliExpressStatePayload {
  const state = String(rawState || '').trim();
  if (!state.includes('.')) throw new Error('Invalid OAuth state');
  const [payload, signature] = state.split('.', 2);
  const expected = signStatePayload(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error('Invalid OAuth state signature');
  }
  const parsed = JSON.parse(base64UrlDecode(payload)) as AliExpressStatePayload;
  if (!parsed?.profileId) throw new Error('OAuth state missing profile id');
  if (!parsed?.ts || Date.now() - Number(parsed.ts) > STATE_TTL_MS) {
    throw new Error('OAuth state expired');
  }
  return parsed;
}

export async function resolveProfileIdFromAccessToken(rawAccessToken: string | null | undefined) {
  const accessToken = String(rawAccessToken || '').trim();
  if (!accessToken) throw new Error('Missing access_token');
  const supabase = createSupabaseAuthed(buildAuthHeader(accessToken));
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error(error?.message || 'Unauthorized');

  const userId = data.user.id;
  const supabaseAdmin = createSupabaseAdmin();
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  const profileId = String((profile as any)?.id || '').trim();
  if (!profileId) throw new Error('Profile not found');
  return profileId;
}

export function buildAliExpressAuthorizeUrl(state: string) {
  const url = new URL(getAliExpressAuthorizeUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', getAliExpressAppKey());
  url.searchParams.set('redirect_uri', getAliExpressRedirectUri());
  url.searchParams.set('state', state);
  return url.toString();
}

function resolveExpiryIso(payload: AliExpressTokenResponse) {
  const expireTime = Number(payload?.expire_time);
  if (Number.isFinite(expireTime) && expireTime > 0) {
    const ms = expireTime > 1e12 ? expireTime : expireTime * 1000;
    return new Date(ms).toISOString();
  }
  const expiresIn = Number(payload?.expires_in);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    return new Date(Date.now() + expiresIn * 1000).toISOString();
  }
  return null;
}

export async function exchangeAliExpressCodeForTokens(code: string) {
  const form = new URLSearchParams();
  form.set('grant_type', 'authorization_code');
  form.set('code', String(code || '').trim());
  form.set('redirect_uri', getAliExpressRedirectUri());
  form.set('client_id', getAliExpressAppKey());
  form.set('client_secret', getAliExpressAppSecret());
  form.set('app_key', getAliExpressAppKey());
  form.set('app_secret', getAliExpressAppSecret());

  const response = await fetch(getAliExpressTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form.toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as AliExpressTokenResponse;
  if (!response.ok || !String(payload?.access_token || '').trim()) {
    const detail = payload?.error_description || payload?.error || `AliExpress token exchange failed (${response.status})`;
    throw new Error(String(detail));
  }

  return {
    accessToken: String(payload.access_token || '').trim(),
    refreshToken: String(payload.refresh_token || '').trim(),
    expiresAt: resolveExpiryIso(payload),
    externalUserId: String(payload.ali_user_id || payload.user_id || '').trim() || null,
    raw: payload,
  };
}

export async function saveAliExpressTokens(params: {
  profileId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  externalUserId?: string | null;
  raw?: Record<string, unknown>;
}) {
  const supabaseAdmin = createSupabaseAdmin();
  const authUserId = await resolveAuthUserIdFromProfileId(params.profileId);
  if (!authUserId) throw new Error('Auth user not found for profile');
  const settings = {
    token_expires_at: params.expiresAt || null,
    encrypted_refresh_token: params.refreshToken ? encryptSecret(params.refreshToken) : null,
    ali_user_id: params.externalUserId || null,
    oauth_provider: 'AliExpress',
    last_token_sync_at: new Date().toISOString(),
    raw_token_payload: params.raw || {},
  };

  const { data, error } = await supabaseAdmin
    .from('user_integrations')
    .upsert(
      {
        user_id: authUserId,
        platform: PLATFORM,
        api_key: encryptSecret(params.accessToken),
        store_url: null,
        webhook_url: null,
        is_active: true,
        status: 'active',
        settings,
        connected_at: new Date().toISOString(),
        last_sync: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform' }
    )
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as AliExpressStoredIntegration | null;
}

export async function getAliExpressIntegration(profileId: string) {
  const supabaseAdmin = createSupabaseAdmin();
  const authUserId = await resolveAuthUserIdFromProfileId(profileId);
  if (!authUserId) throw new Error('Auth user not found for profile');
  const { data, error } = await supabaseAdmin
    .from('user_integrations')
    .select('*')
    .eq('user_id', authUserId)
    .eq('platform', PLATFORM)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as AliExpressStoredIntegration | null) || null;
}

export async function getAliExpressAccessToken(profileId: string) {
  const integration = await getAliExpressIntegration(profileId);
  if (!integration?.api_key) throw new Error('AliExpress is not connected');
  const accessToken = decryptSecret(integration.api_key);
  if (!accessToken) throw new Error('AliExpress access token is missing');
  const settings = (integration.settings || {}) as Record<string, unknown>;
  return {
    integration,
    accessToken,
    refreshToken: settings.encrypted_refresh_token
      ? decryptSecret(String(settings.encrypted_refresh_token))
      : '',
    expiresAt: String(settings.token_expires_at || '').trim() || null,
  };
}

function formatAliTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function buildAliExpressSignString(pathname: string, params: Record<string, unknown>) {
  const sortedKeys = Object.keys(params)
    .filter((key) => key !== 'sign' && params[key] !== undefined && params[key] !== null && String(params[key]).length > 0)
    .sort((left, right) => left.localeCompare(right));
  const pairs = sortedKeys.map((key) => `${key}${String(params[key])}`).join('');
  return `${pathname}${pairs}`;
}

export function signAliExpressRequest(pathname: string, params: Record<string, unknown>) {
  const content = buildAliExpressSignString(pathname, params);
  return crypto.createHmac('sha256', getAliExpressAppSecret()).update(content, 'utf8').digest('hex').toUpperCase();
}

export async function callAliExpressApi(params: {
  profileId: string;
  method: string;
  apiParams?: Record<string, unknown>;
}) {
  const { accessToken } = await getAliExpressAccessToken(params.profileId);
  const apiUrl = new URL(getAliExpressApiUrl());
  const baseParams: Record<string, unknown> = {
    method: params.method,
    app_key: getAliExpressAppKey(),
    sign_method: 'sha256',
    timestamp: formatAliTimestamp(),
    format: 'json',
    v: '2.0',
    simplify: 'true',
    session: accessToken,
    ...(params.apiParams || {}),
  };
  const sign = signAliExpressRequest(apiUrl.pathname || '/sync', baseParams);
  const body = new URLSearchParams();
  Object.entries({ ...baseParams, sign }).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    body.set(key, String(value));
  });

  const response = await fetch(apiUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(async () => {
    const text = await response.text().catch(() => '');
    return { raw_text: text };
  });

  if (!response.ok) {
    throw new Error(String((payload as any)?.message || (payload as any)?.msg || `AliExpress API failed (${response.status})`));
  }

  return payload;
}

export function summarizeAliExpressIntegration(integration: AliExpressStoredIntegration | null) {
  if (!integration) {
    return {
      connected: false,
      platform: PLATFORM,
    };
  }

  const settings = (integration.settings || {}) as Record<string, unknown>;
  return {
    connected: Boolean(integration.is_active ?? true),
    platform: PLATFORM,
    status: integration.status || 'inactive',
    connected_at: integration.connected_at,
    last_sync: integration.last_sync,
    expires_at: String(settings.token_expires_at || '').trim() || null,
    ali_user_id: String(settings.ali_user_id || '').trim() || null,
    access_token: integration.api_key ? maskSecret(decryptSecret(integration.api_key)) : null,
  };
}
