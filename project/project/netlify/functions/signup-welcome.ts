import type { Handler } from '@netlify/functions';
import { createSupabaseAuthed, findSupabaseAdminForUser } from './_lib/supabase';
import { sendBusinessWelcome } from './_lib/business-welcome';
import { json } from './_lib/http';
import { SIGNUP_GUIDE_LAUNCHED_AT } from '../../src/content/signupWelcome';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PATCH' && event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Sign in required' });
  try {
    const { data, error } = await createSupabaseAuthed(authorization).auth.getUser();
    if (error || !data.user) return json(401, { error: 'Sign in required' });
    const { supabaseAdmin, authUser } = await findSupabaseAdminForUser(data.user.id, data.user.email);
    if (!supabaseAdmin || !authUser) return json(401, { error: 'Account not found' });
    if (event.httpMethod === 'GET') {
      return json(200, {
        completed: Boolean(authUser.app_metadata?.signup_welcome_completed_at),
        emailed: Boolean(authUser.app_metadata?.business_welcome_sent_at || authUser.app_metadata?.shopper_welcome_sent_at),
      });
    }
    if (event.httpMethod === 'PATCH') {
      if (!authUser.email_confirmed_at || !(Date.parse(authUser.created_at) >= SIGNUP_GUIDE_LAUNCHED_AT)) {
        return json(403, { error: 'Welcome guide is unavailable for this account' });
      }
      if (!authUser.app_metadata?.signup_welcome_completed_at) {
        const { error: saveError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          app_metadata: { signup_welcome_completed_at: new Date().toISOString() },
        });
        if (saveError) return json(502, { error: 'Could not save welcome guide completion' });
      }
      return json(200, { completed: true });
    }
    const result = await sendBusinessWelcome(supabaseAdmin, authUser);
    const skipped = ['unconfirmed', 'before_tutorial_launch', 'already_sent', 'not_business'].includes(result.reason || '');
    return json(result.sent || skipped ? 200 : 502, result);
  } catch {
    return json(500, { error: 'Welcome tutorial delivery unavailable' });
  }
};

export default handler;
