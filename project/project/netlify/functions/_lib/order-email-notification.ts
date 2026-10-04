export function orderEmailNotification(params: { orderId: string; emailType: string; recipientEmail: string; subject: string; html: string; sent: boolean; reason?: string; metadata?: any }) {
  return {
    order_id: params.orderId,
    recipient_email: params.recipientEmail,
    recipient_type: params.emailType === 'product_sold' ? 'seller' : params.emailType === 'commission_earned' ? 'affiliate' : 'buyer',
    notification_type: 'order_confirmation',
    status: params.sent ? 'sent' : 'failed',
    sent_at: params.sent ? new Date().toISOString() : null,
    error_message: params.sent ? null : params.reason || 'delivery_failed',
    email_data: { email_type: params.emailType, subject: params.subject, content: params.html, metadata: params.metadata || null },
  };
}

export async function resolveSaleNotificationEmail(db: any, profileId: string, role: string): Promise<string> {
  const profile = await db.from('profiles').select('email').eq('id', profileId).maybeSingle();
  const email = String(profile.data?.email || '').trim();
  if (email) return email;
  const account = await db.from('paypal_accounts').select('paypal_email').eq('user_id', profileId).eq('role', role).maybeSingle();
  return String(account.data?.paypal_email || '').trim();
}
