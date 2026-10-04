import { describe, expect, it } from 'vitest';
import { orderEmailNotification, resolveSaleNotificationEmail } from './order-email-notification';

describe('order email delivery records', () => {
  it('records both recipients using the production notification constraints', () => {
    for (const [emailType, role] of [['order_confirmation', 'buyer'], ['product_sold', 'seller']]) {
      const row = orderEmailNotification({ orderId: 'order', emailType, recipientEmail: 'account@example.com', subject: 'Paid order', html: '<p>Paid</p>', sent: true });
      expect(row.recipient_type).toBe(role);
      expect(row.notification_type).toBe('order_confirmation');
      expect(row.status).toBe('sent');
      expect(row.sent_at).toBeTruthy();
    }
  });
  it('records delivery failure without claiming a send time', () => {
    const row = orderEmailNotification({ orderId: 'order', emailType: 'order_confirmation', recipientEmail: 'account@example.com', subject: 'Paid order', html: '', sent: false, reason: 'missing_resend_key' });
    expect(row.sent_at).toBeNull();
    expect(row.status).toBe('failed');
    expect(row.error_message).toBe('missing_resend_key');
  });
  it('sends sale alerts to the seller account instead of a different payout email', async () => {
    const db: any = { from: (table: string) => {
      expect(table).toBe('profiles');
      const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { email: 'seller-account@example.com' } }) };
      return query;
    } };
    expect(await resolveSaleNotificationEmail(db, 'seller', 'SELLER')).toBe('seller-account@example.com');
  });
});
