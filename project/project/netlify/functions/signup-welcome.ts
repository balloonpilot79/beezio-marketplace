import type { Handler } from '@netlify/functions';
import { createSupabaseAuthed, findSupabaseAdminForUser } from './_lib/supabase';
import { sendBusinessWelcome } from './_lib/business-welcome';
import { json } from './_lib/http';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  if (!authorization.startsWith('Bearer ')) return json(401, { error: 'Sign in required' });
  try {
    const { data, error } = await createSupabaseAuthed(authorization).auth.getUser();
    if (error || !data.user) return json(401, { error: 'Sign in required' });
    const { supabaseAdmin, authUser } = await findSupabaseAdminForUser(data.user.id, data.user.email);
    if (!supabaseAdmin || !authUser) return json(401, { error: 'Account not found' });
    const result = await sendBusinessWelcome(supabaseAdmin, authUser);
    return json(result.reason === 'delivery_pending' ? 502 : 200, result);
  } catch {
    return json(500, { error: 'Welcome tutorial delivery unavailable' });
  }
};

export default handler;
