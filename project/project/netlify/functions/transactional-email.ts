import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { sendTransactionalEmail } from './_lib/email';

type SupportedEmailType =
  | 'welcome'
  | 'password_reset'
  | 'order_confirmation'
  | 'order_shipped'
  | 'order_delivered'
  | 'payment_received'
  | 'commission_earned'
  | 'product_sold'
  | 'new_affiliate_signup'
  | 'weekly_report'
  | 'account_verification'
  | 'support_ticket'
  | 'marketing_update';

type Body = {
  to?: string;
  subject?: string;
  html?: string;
  type?: SupportedEmailType;
  userId?: string;
  metadata?: Record<string, unknown> | null;
};

const allowedTypes = new Set<SupportedEmailType>([
  'welcome',
  'password_reset',
  'order_confirmation',
  'order_shipped',
  'order_delivered',
  'payment_received',
  'commission_earned',
  'product_sold',
  'new_affiliate_signup',
  'weekly_report',
  'account_verification',
  'support_ticket',
  'marketing_update',
]);

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);

    const body = parseJson<Body>(event.body);
    const to = String(body?.to || '').trim();
    const subject = String(body?.subject || '').trim();
    const html = String(body?.html || '').trim();
    const type = String(body?.type || '').trim() as SupportedEmailType;
    const userId = String(body?.userId || '').trim() || null;
    const metadata = body?.metadata && typeof body.metadata === 'object' ? body.metadata : null;

    if (!to || !to.includes('@')) return json(400, { error: 'Valid recipient email is required.' });
    if (!subject) return json(400, { error: 'Email subject is required.' });
    if (!html) return json(400, { error: 'Email html is required.' });
    if (!allowedTypes.has(type)) return json(400, { error: 'Unsupported email type.' });

    const result = await sendTransactionalEmail({ to, subject, html });
    if (!result.sent) {
      return json(502, { error: 'Email delivery failed.', reason: result.reason || 'unknown' });
    }

    try {
      const supabaseAdmin = createSupabaseAdmin();
      await supabaseAdmin.from('email_notifications').insert({
        user_id: userId,
        email_type: type,
        recipient_email: to,
        subject,
        content: html,
        metadata,
        sent_at: new Date().toISOString(),
        status: 'sent',
      } as any);
    } catch (logError) {
      console.warn('[transactional-email] email log failed (non-fatal):', logError);
    }

    return json(200, { ok: true, sent: true });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
