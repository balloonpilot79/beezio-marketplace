import { sendTransactionalEmail } from './email';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export function buildBusinessWelcomeEmail(name: string) {
  // Keep account links on Beezio, never on a client-supplied host or deploy preview.
  const site = 'https://beezio.co';
  const link = (path: string, label: string) => `<a style="color:#765400;font-weight:bold" href="${site}${path}">${label}</a>`;
  return {
    subject: 'Welcome to Beezio — your business getting-started tutorial',
    html: `<!doctype html><html><body style="margin:0;background:#f4f4f4;color:#171717;font-family:Arial,sans-serif;line-height:1.6">
      <div style="max-width:640px;margin:0 auto;background:#fff">
        <div style="background:#ffcb05;padding:28px 24px"><h1 style="margin:0;color:#101820">Welcome to Beezio!</h1><p style="margin:8px 0 0">Your business account. Three ways to get started.</p></div>
        <div style="padding:24px">
          <p>Hi ${escapeHtml(name || 'there')},</p>
          <p>Your business account gives you seller, affiliate, and ambassador tools in one place. Start with the path that fits you, and return to the others whenever you are ready. Joining Beezio and creating your store are free.</p>
          <h2 style="font-size:21px">1. Find your way around</h2>
          <p>Sign in and ${link('/business', 'open your business dashboard')}. Use <strong>Seller</strong>, <strong>Affiliate</strong>, and <strong>Ambassador</strong> to explore your business tools. You can also shop with the same account.</p>
          <h2 style="font-size:21px">2. Set up your store</h2>
          <p>Choose <strong>Customize My Store</strong> or ${link('/store-builder', 'open the store builder')}. Add your store name, logo, description, colors, and policies. Save your changes, preview your store, and copy your store link when you are ready to share.</p>
          <h2 style="font-size:21px">3. Sell your own products</h2>
          <p>Open ${link('/business?section=seller&tab=products', 'Seller → Products')} and add a product. Include clear photos, an accurate description, condition, available quantity, and shipping details. Enter the amount you want to receive and review the displayed buyer price before publishing.</p>
          <p>You choose whether each product participates in affiliate promotion. If it does, set the affiliate payout. When an order comes in, use ${link('/business?section=seller&tab=orders', 'Orders')} to review it, arrange fulfillment, and add tracking when available. Sellers are responsible for fulfilling their orders.</p>
          <h2 style="font-size:21px">4. Promote products as an affiliate</h2>
          <p>Visit the ${link('/marketplace', 'marketplace')} while signed in to your business account. Find a product offering affiliate earnings and choose <strong>Add to My Store</strong>. Share your own store or product promotion link so your referral can be tracked.</p>
          <p>You do not need to buy inventory or ship another seller’s products. The seller fulfills those orders; you earn the listed affiliate amount on qualifying sales you refer. If you list your own products, you handle those orders as the seller.</p>
          <h2 style="font-size:21px">5. Invite businesses as an ambassador</h2>
          <p>Open ${link('/business?section=influencer&tab=influencer-promo', 'My Referral Links & Invites')}. Copy your personal invitation link or use your QR code to invite sellers and affiliates. Ask people to register through that link so Beezio can attach the referral to you.</p>
          <p>Ambassador earnings come from qualifying sales associated with your referrals. A signup alone does not generate earnings. Use your dashboard to track activity and earnings.</p>
          <h2 style="font-size:21px">6. Check payouts and messages</h2>
          <p>Open ${link('/business?section=seller&tab=financials', 'Financials')} to review earnings, held funds, available amounts, and payout requirements. Check your PayPal payout details and complete any requested account or tax information. Held, refunded, or disputed transactions can affect payout availability.</p>
          <p>Check your dashboard messages and order updates regularly so customers can reach you.</p>
          <h2 style="font-size:21px">7. Take one first step today</h2>
          <p>Choose one: publish your first product, add one affiliate product to your store, or send your ambassador link to a business owner who may find Beezio useful. Share accurate descriptions and avoid promising guaranteed income.</p>
          <p style="margin:28px 0"><a href="${site}/business" style="display:inline-block;background:#ffcb05;color:#101820;padding:14px 22px;border-radius:6px;font-weight:bold;text-decoration:none">Open my business dashboard</a></p>
          <p>Need help? Reply to this email or contact <a href="mailto:support@beezio.co">support@beezio.co</a>.</p>
          <p>The Beezio Team</p>
        </div>
      </div>
    </body></html>`,
  };
}

/** One onboarding message per new, verified business account, even across callback retries. */
export async function sendBusinessWelcome(db: any, user: any): Promise<{ sent: boolean; reason?: string }> {
  try {
    if (!user?.email_confirmed_at || !user.email) return { sent: false, reason: 'unconfirmed' };
    const age = Date.now() - new Date(user.created_at).getTime();
    if (!Number.isFinite(age) || age < 0 || age >= 24 * 60 * 60 * 1000) {
      return { sent: false, reason: 'not_new_signup' };
    }
    // Refresh trusted metadata: the confirmation and bootstrap calls can hold different snapshots.
    const fresh = await db.auth.admin.getUserById(user.id);
    if (fresh.error || !fresh.data?.user) return { sent: false, reason: 'user_lookup_failed' };
    user = fresh.data.user;
    if (user.app_metadata?.business_welcome_sent_at) return { sent: false, reason: 'already_sent' };
    const roles = await db.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
    if (roles.error) return { sent: false, reason: 'role_lookup_failed' };
    if (!roles.data?.some((row: any) => ['seller', 'affiliate', 'influencer'].includes(row.role))) {
      return { sent: false, reason: 'not_business' };
    }
    const template = buildBusinessWelcomeEmail(String(user.user_metadata?.full_name || 'there'));
    const result = await sendTransactionalEmail({
      to: user.email, ...template,
      from: 'Beezio Welcome <welcome@beezio.co>',
      replyTo: 'support@beezio.co',
      // Resend deduplicates concurrent requests for 24h, matching the signup window above.
      idempotencyKey: `business-welcome/${user.id}`,
      timeoutMs: 10000,
    });
    if (!result.sent) {
      console.warn('[business-welcome] delivery failed', { userId: user.id, reason: result.reason });
      return result;
    }
    const marked = await db.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, business_welcome_sent_at: new Date().toISOString(), business_welcome_version: 1 },
    });
    if (marked.error) console.warn('[business-welcome] delivery marker failed', { userId: user.id });
    console.info('[business-welcome] tutorial accepted by email provider', { userId: user.id });
    return result;
  } catch (error) {
    // Email must not prevent registration; confirmation/bootstrap retries can retry delivery.
    console.warn('[business-welcome] delivery pending', error instanceof Error ? error.message : 'unknown');
    return { sent: false, reason: 'delivery_pending' };
  }
}
