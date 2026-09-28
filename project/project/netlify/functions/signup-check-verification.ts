import type { Handler } from '@netlify/functions';
import { assertPost, json, parseJson } from './_lib/http';
import { findSupabaseAdminForUser } from './_lib/supabase';

type Body = {
  userId?: string;
  email?: string;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const body = parseJson<Body>(event.body);
    const userId = String(body?.userId || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!userId || !email || !email.includes('@')) {
      return json(400, { error: 'Valid userId and email are required.' });
    }

    const { authUser, error: userError } = await findSupabaseAdminForUser(userId, email);
    if (!authUser) {
      return json(404, { error: 'User not found.', details: userError?.message || null });
    }

    return json(200, {
      ok: true,
      confirmed: authUser.app_metadata?.beezio_email_verified === true,
      confirmedAt: authUser.email_confirmed_at || null,
    });
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
