import type { Handler } from '@netlify/functions';
import { assertPost, json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';

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

    const supabaseAdmin = createSupabaseAdmin();
    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    const authUser = userResult?.user;
    if (userError || !authUser) {
      return json(404, { error: 'User not found.', details: userError?.message || null });
    }

    const authEmail = String(authUser.email || '').trim().toLowerCase();
    if (authEmail !== email) {
      return json(403, { error: 'Email mismatch.' });
    }

    return json(200, {
      ok: true,
      confirmed: Boolean(authUser.email_confirmed_at),
      confirmedAt: authUser.email_confirmed_at || null,
    });
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
