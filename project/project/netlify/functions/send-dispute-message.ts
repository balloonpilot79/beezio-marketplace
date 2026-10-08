import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser, requireAdmin } from './_lib/auth';
import { json, assertPost, parseJson } from './_lib/http';
import { notifyDisputeParties } from './_lib/dispute-alerts';

type Body = {
  disputeId?: string;
  body?: string;
};

const normalize = (value: unknown) => String(value || '').trim();

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);

    const authHeader = extractAuthHeader(event as any);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: 'Unauthorized', details: authErr });

    const body = parseJson<Body>(event.body);
    const disputeId = normalize(body?.disputeId);
    const messageBody = normalize(body?.body);

    if (!disputeId) return json(400, { error: 'Missing disputeId' });
    if (!messageBody) return json(400, { error: 'Message is empty' });
    if (messageBody.length > 4000) return json(400, { error: 'Message too long' });

    const supabaseAdmin = createSupabaseAdmin();
    const senderUserId = String(user.id);

    let isAdmin = false;
    try {
      await requireAdmin(event as any);
      isAdmin = true;
    } catch {
      isAdmin = false;
    }

    const { data: dispute } = await supabaseAdmin
      .from('disputes')
      .select('id, filed_by, filed_against, status')
      .eq('id', disputeId)
      .maybeSingle();

    if (!(dispute as any)?.id) return json(404, { error: 'Dispute not found' });

    if (['resolved', 'closed'].includes(normalize((dispute as any)?.status))) {
      return json(409, { error: 'This dispute is closed. Please open a new support request.' });
    }

    const filedBy = normalize((dispute as any)?.filed_by);
    const filedAgainst = normalize((dispute as any)?.filed_against);
    if (!isAdmin && senderUserId !== filedBy && senderUserId !== filedAgainst) {
      return json(403, { error: 'Forbidden' });
    }

    const { data: msg, error: msgError } = await supabaseAdmin
      .from('dispute_messages')
      .insert({
        dispute_id: disputeId,
        sender_id: senderUserId,
        message: messageBody,
        is_admin_message: isAdmin,
      } as any)
      .select('id, dispute_id, sender_id, message, is_admin_message, created_at')
      .single();

    if (msgError || !msg) return json(400, { error: 'Failed to send', details: msgError?.message || null });

    await supabaseAdmin
      .from('disputes')
      .update({ updated_at: new Date().toISOString() } as any)
      .eq('id', disputeId);

    const alerts = await notifyDisputeParties(supabaseAdmin, {
      disputeId, event: 'message', actorId: senderUserId, messageId: String(msg.id),
    });

    return json(200, { message: msg, alerts });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export default handler;
