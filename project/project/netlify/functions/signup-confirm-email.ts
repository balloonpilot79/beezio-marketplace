import type { Handler } from '@netlify/functions';
import { assertPost, json, parseJson } from './_lib/http';
import { findSupabaseAdminForUser } from './_lib/supabase';
import { verifySignupVerifyToken } from './_lib/signup-verify-token';

type Body = {
  token?: string;
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const body = parseJson<Body>(event.body);
    const token = String(body?.token || '').trim();
    if (!token) return json(400, { error: 'Verification token is required.' });

    const parsed = verifySignupVerifyToken(token);
    const { supabaseAdmin, authUser, error: userError } = await findSupabaseAdminForUser(parsed.userId, parsed.email);
    if (!supabaseAdmin || !authUser) {
      return json(404, { error: 'User not found.', details: userError?.message || null });
    }

    if (!authUser.email_confirmed_at) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(parsed.userId, {
        email_confirm: true,
      } as any);
      if (updateError) {
        return json(500, { error: 'Failed to confirm email.', details: updateError.message });
      }
    }

    return json(200, {
      ok: true,
      confirmed: true,
      user: {
        id: authUser.id,
        email: authUser.email,
        email_confirmed_at: authUser.email_confirmed_at || new Date().toISOString(),
        user_metadata: authUser.user_metadata || {},
      },
    });
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
