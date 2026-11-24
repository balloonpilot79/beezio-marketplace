import { sendTransactionalEmail } from './email';
import { SIGNUP_GUIDE_LAUNCHED_AT, signupWelcomeGuides, WELCOME_SUPPORT } from '../../../src/content/signupWelcome';
import type { SignupGuideAudience } from '../../../src/content/signupWelcome';

const SITE = 'https://beezio.co';

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

function buildWelcomeEmail(name: string, audience: SignupGuideAudience) {
  const guide = signupWelcomeGuides[audience];
  const steps = guide.steps.map(step => `
    <section style="margin:24px 0;padding-top:16px;border-top:1px solid #e5e7eb">
      <h2 style="font-size:22px;line-height:1.3;margin:0 0 12px">${escapeHtml(step.heading)}</h2>
      ${step.image ? `<img src="${SITE}/tutorial/business-v2/${step.image}" alt="Beezio example: ${escapeHtml(step.heading)}" width="592" style="display:block;width:100%;max-width:592px;height:auto;border:1px solid #e5e7eb;border-radius:8px">` : ''}
      <ol style="padding-left:22px">${step.instructions.map(instruction => `<li style="margin:6px 0">${escapeHtml(instruction)}</li>`).join('')}</ol>
      <p><a href="${SITE}${escapeHtml(step.path)}" style="color:#765400;font-weight:bold">${escapeHtml(step.action)}</a></p>
    </section>`).join('');
  return {
    subject: guide.subject,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(guide.subject)}</title></head><body style="margin:0;background:#f4f4f4;color:#171717;font-family:Arial,sans-serif;line-height:1.6">
    <div style="max-width:640px;margin:0 auto;background:white">
      <header style="background:#ffcb05;padding:24px"><h1 style="margin:0;color:#101820">Welcome to Beezio!</h1></header>
      <main style="padding:24px">
        <p>Hi ${escapeHtml(name || 'there')},</p><p>${escapeHtml(guide.intro)}</p>
        <p>Save this email so you can return to your welcome guide anytime.</p>
        ${steps}
        ${audience === 'business' ? `<p><a href="${SITE}/tutorial/business-v2/Beezio-Visual-Welcome-Guide.pdf">Download the illustrated Business Account guide (PDF)</a></p>` : ''}
        <p><a href="${SITE}${guide.dashboard}" style="display:inline-block;background:#101820;color:#ffcb05;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Open your Beezio account</a></p>
        <p>Need help? Email <a href="mailto:${WELCOME_SUPPORT}">${WELCOME_SUPPORT}</a>.</p>
        <p>Jason Loving<br>Founder, Beezio</p>
      </main>
    </div></body></html>`,
  };
}

export const buildBusinessWelcomeEmail = (name: string) => buildWelcomeEmail(name, 'business');
export const buildShopperWelcomeEmail = (name: string) => buildWelcomeEmail(name, 'shopper');

// Earlier accounts predate the visual tutorial rollout. Failed onboarding for
// accounts created since launch remains eligible on later sign-ins.
export const BUSINESS_WELCOME_LAUNCHED_AT = Date.parse('2026-11-13T00:00:00Z');

/** One welcome email per verified signup, even across callback retries. */
export async function sendBusinessWelcome(db: any, user: any): Promise<{ sent: boolean; reason?: string; providerId?: string }> {
  try {
    // Refresh first: caller snapshots may predate confirmation or a successful send.
    const fresh = await db.auth.admin.getUserById(user.id);
    if (fresh.error || !fresh.data?.user) return { sent: false, reason: 'user_lookup_failed' };
    user = fresh.data.user;
    if (!user?.email_confirmed_at || !user.email) return { sent: false, reason: 'unconfirmed' };
    const createdAt = Date.parse(user.created_at);
    if (!Number.isFinite(createdAt) || createdAt > Date.now() || createdAt < BUSINESS_WELCOME_LAUNCHED_AT) {
      return { sent: false, reason: 'before_tutorial_launch' };
    }
    if (user.app_metadata?.business_welcome_sent_at || user.app_metadata?.shopper_welcome_sent_at) {
      return { sent: false, reason: 'already_sent' };
    }
    const roles = await db.from('user_roles').select('role').eq('user_id', user.id).eq('is_active', true);
    if (roles.error) return { sent: false, reason: 'role_lookup_failed' };
    const activeRoles: string[] = (roles.data || []).map((row: { role: string }) => row.role);
    const businessRole = ['seller', 'affiliate', 'influencer'].find(role => activeRoles.includes(role));
    const shopper = activeRoles.includes('buyer') && user.user_metadata?.account_type === 'buyer'
      && createdAt >= SIGNUP_GUIDE_LAUNCHED_AT;
    if (!businessRole && !shopper) {
      const waitsForRoles = createdAt >= SIGNUP_GUIDE_LAUNCHED_AT
        && ['business', 'buyer'].includes(user.user_metadata?.account_type);
      return { sent: false, reason: waitsForRoles ? 'role_lookup_failed' : 'not_business' };
    }
    const audience = shopper ? 'shopper' : 'business';
    const sentMarker = shopper ? 'shopper_welcome_sent_at' : 'business_welcome_sent_at';
    const template = buildWelcomeEmail(String(user.user_metadata?.full_name || 'there'), audience);
    const result = await sendTransactionalEmail({
      to: user.email, ...template,
      from: 'Beezio Welcome <welcome@beezio.co>',
      replyTo: WELCOME_SUPPORT,
      // Resend deduplicates concurrent attempts; trusted metadata prevents later duplicates.
      idempotencyKey: `${audience}-welcome/${user.id}`,
      timeoutMs: 10000,
    });
    const logged = await db.from('email_notifications').insert({
      recipient_email: user.email,
      recipient_type: shopper ? 'buyer' : businessRole,
      notification_type: 'business_welcome',
      status: result.sent ? 'sent' : 'failed',
      sent_at: result.sent ? new Date().toISOString() : null,
      error_message: result.sent ? null : result.reason || 'delivery_failed',
      email_data: { user_id: user.id, subject: template.subject, version: 3, audience,
        provider: 'resend', provider_id: result.providerId || null },
    });
    if (logged.error) console.warn('[business-welcome] email history failed', { userId: user.id });
    if (!result.sent) {
      console.warn('[business-welcome] delivery failed', { userId: user.id, reason: result.reason });
      return result;
    }
    const marked = await db.auth.admin.updateUserById(user.id, {
      app_metadata: {
        [sentMarker]: new Date().toISOString(),
        [`${audience}_welcome_version`]: 3,
        [`${audience}_welcome_provider_id`]: result.providerId,
      },
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
