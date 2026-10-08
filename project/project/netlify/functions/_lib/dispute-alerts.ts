import { sendTransactionalEmail } from './email';

type AlertEvent = 'opened' | 'message' | 'resolved';
type RecipientRole = 'buyer' | 'seller' | 'affiliate' | 'influencer' | 'admin';

const escapeHtml = (input: unknown) => String(input ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const normalize = (value: unknown) => String(value || '').trim();
const siteUrl = String(process.env.SITE_URL || process.env.URL || 'https://beezio.co').replace(/\/$/, '');

interface DisputeAlertOptions {
  disputeId: string;
  event: AlertEvent;
  actorId?: string | null;
  messageId?: string | null;
  resolutionType?: string | null;
}

export async function notifyDisputeParties(db: any, options: DisputeAlertOptions) {
  const { data: dispute, error: disputeError } = await db.from('disputes')
    .select('id, order_id, filed_by, filed_against, status')
    .eq('id', options.disputeId).maybeSingle();
  if (disputeError || !dispute?.id) return { sent: 0, failed: 0, reason: 'dispute_missing' };

  const { data: order } = dispute.order_id
    ? await db.from('orders').select('order_number, buyer_id, seller_id, partner_id, affiliate_id, influencer_id, customer_email')
      .eq('id', dispute.order_id).maybeSingle()
    : { data: null };

  const recipientIds: { id: string; role: RecipientRole }[] = [];
  const add = (id: unknown, role: RecipientRole) => {
    const value = normalize(id);
    if (value && !recipientIds.some((item) => item.id === value && item.role === role)) {
      recipientIds.push({ id: value, role });
    }
  };
  add(order?.buyer_id || dispute.filed_by, 'buyer');
  add(order?.seller_id || dispute.filed_against, 'seller');
  if (options.event !== 'message') {
    add(order?.partner_id || order?.affiliate_id, 'affiliate');
    add(order?.influencer_id, 'influencer');
  }

  const ids = Array.from(new Set(recipientIds.map((item) => item.id)));
  const profileRows = ids.length
    ? await db.from('profiles').select('id,user_id,email').in('user_id', ids)
    : { data: [] };
  const { data: admins } = await db.from('profiles').select('id,user_id,email')
    .or('role.eq.admin,primary_role.eq.admin');

  const profileEmails = new Map<string, string>();
  for (const profile of profileRows.data || []) {
    if (profile?.id) profileEmails.set(String(profile.id), normalize(profile.email));
    if (profile?.user_id) profileEmails.set(String(profile.user_id), normalize(profile.email));
  }

  const recipients = new Map<string, { email: string; role: RecipientRole }>();
  const put = (email: unknown, role: RecipientRole) => {
    const value = normalize(email).toLowerCase();
    if (value.includes('@') && !recipients.has(value)) recipients.set(value, { email: value, role });
  };
  for (const item of recipientIds) put(profileEmails.get(item.id), item.role);
  if (order?.customer_email) put(order.customer_email, 'buyer');

  for (const admin of admins || []) put(admin.email, 'admin');
  for (const email of String(process.env.ADMIN_EMAILS || '').split(/[,;\s]+/)) put(email, 'admin');

  const orderLabel = normalize(order?.order_number) || normalize(dispute.order_id).slice(0, 8) || 'your order';
  const subjectAction = options.event === 'opened' ? 'Dispute opened'
    : options.event === 'resolved' ? 'Dispute resolved' : 'New dispute message';
  const notificationType = options.event === 'opened' ? 'dispute_opened'
    : options.event === 'resolved' ? 'dispute_resolved' : 'dispute_message';
  const eventKey = [options.disputeId, options.event, options.messageId || options.resolutionType || 'initial'].join(':');
  const actor = normalize(options.actorId);

  let sent = 0;
  let failed = 0;
  const results = await Promise.allSettled(Array.from(recipients.values()).map(async (recipient) => {
    // Do not re-email the sender on every reply. Open and resolution notices go to everyone.
    if (options.event === 'message' && actor && recipient.role !== 'admin' &&
        recipientIds.some((item) => item.id === actor && item.role === recipient.role)) return;

    // A support reply should not expose issue details to earners who are not dispute participants.
    const isEarner = recipient.role === 'affiliate' || recipient.role === 'influencer';
    const title = isEarner ? (options.event === 'opened' ? 'Earnings temporarily on hold' : 'Order payout updated') : subjectAction;
    const description = isEarner
      ? (options.event === 'opened'
        ? 'One order associated with your earnings is under review. Its payout is held while Beezio resolves the issue. Other orders are not affected.'
        : 'An order associated with your earnings has completed a dispute review. Check your earnings dashboard for its final payout status.')
      : (options.event === 'opened'
        ? 'A customer support dispute has been opened. The associated seller and Beezio support can respond in the Issue Center. Payments for this order are paused until a decision is reached.'
        : options.event === 'resolved'
          ? (options.resolutionType === 'refund_full' || options.resolutionType === 'buyer_favor'
            ? 'The case has been resolved with a full refund. The earnings associated with this order have been canceled.'
            : 'The case has been resolved. Any eligible earnings remain subject to the normal payout rules.')
          : 'There is a new message in the dispute conversation. Sign in to read it and respond.');

    const url = recipient.role === 'admin' ? siteUrl + '/support/ops'
      : isEarner ? siteUrl + '/dashboard'
      : siteUrl + '/contact-support';
    const subject = 'Beezio: ' + title + ' — ' + orderLabel;
    const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:22px">
      <h2>${escapeHtml(title)}</h2><p><strong>Order:</strong> ${escapeHtml(orderLabel)}</p>
      <p>${escapeHtml(description)}</p>
      <p><a href="${escapeHtml(url)}">View Beezio case or dashboard</a></p>
      <p style="color:#555;font-size:12px">Case reference: ${escapeHtml(options.disputeId)}</p>
    </div>`;

    const prior = await db.from('email_notifications').select('id').eq('order_id', dispute.order_id)
      .eq('recipient_email', recipient.email).eq('notification_type', notificationType)
      .eq('status', 'sent').contains('email_data', { event_key: eventKey }).limit(1);
    if (prior.data?.length) return;

    let result: { sent: boolean; reason?: string };
    try {
      result = await sendTransactionalEmail({ to: recipient.email, subject, html });
    } catch (error) {
      result = { sent: false, reason: String(error) };
    }
    const status = result.sent ? 'sent' : 'failed';
    if (result.sent) sent++;
    else failed++;
    await db.from('email_notifications').insert({
      order_id: dispute.order_id,
      recipient_email: recipient.email,
      recipient_type: recipient.role,
      notification_type: notificationType,
      status,
      sent_at: result.sent ? new Date().toISOString() : null,
      error_message: result.sent ? null : String(result.reason || 'email_failed').slice(0, 500),
      email_data: { dispute_id: options.disputeId, event_key: eventKey, subject, recipient_role: recipient.role },
    });
  }));
  for (const result of results) {
    if (result.status === 'rejected') {
      failed++;
      console.error('Dispute alert failed:', result.reason);
    }
  }
  return { sent, failed };
}
