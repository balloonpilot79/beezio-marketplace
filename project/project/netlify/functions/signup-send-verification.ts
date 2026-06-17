import type { Handler } from '@netlify/functions';
import { assertPost, json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { sendTransactionalEmail } from './_lib/email';
import { issueSignupVerifyToken } from './_lib/signup-verify-token';

type Body = {
  userId?: string;
  email?: string;
  fullName?: string;
};

const getSiteUrl = () =>
  String(process.env.SITE_URL || process.env.URL || 'https://beezio.co').trim().replace(/\/$/, '');

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const body = parseJson<Body>(event.body);
    const userId = String(body?.userId || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const fullName = String(body?.fullName || '').trim();

    if (!userId || !email || !email.includes('@')) {
      return json(400, { error: 'Valid userId and email are required.' });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    const authUser = userResult?.user;
    if (userError || !authUser) {
      return json(404, { error: 'User not found.', details: userError?.message || null });
    }

    if (String(authUser.email || '').trim().toLowerCase() !== email) {
      return json(403, { error: 'Email mismatch.' });
    }

    if (authUser.email_confirmed_at) {
      return json(200, { ok: true, alreadyConfirmed: true });
    }

    const verifyToken = issueSignupVerifyToken({
      userId,
      email,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    const siteUrl = getSiteUrl();
    const redirectTo = `${siteUrl}/auth/verify?flow=signup&email=${encodeURIComponent(email)}&verify_token=${encodeURIComponent(verifyToken)}`;
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      return json(500, { error: 'Failed to generate verification link.', details: linkError.message });
    }

    const actionLink =
      String((linkData as any)?.properties?.action_link || '').trim() ||
      String((linkData as any)?.action_link || '').trim();

    if (!actionLink) {
      return json(500, { error: 'Verification link was not created.' });
    }

    const safeName = fullName || String(authUser.user_metadata?.full_name || email.split('@')[0] || 'there').trim();
    const emailResult = await sendTransactionalEmail({
      to: email,
      subject: 'Verify your Beezio email',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
          <h2 style="margin:0 0 12px;">Verify your Beezio email</h2>
          <p style="margin:0 0 12px;">Hi ${safeName}, click the button below to verify your email and activate your Beezio account.</p>
          <p style="margin:18px 0;">
            <a href="${actionLink}" style="display:inline-block;background:#f59e0b;color:#111827;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">
              Verify Email
            </a>
          </p>
          <p style="margin:0 0 12px;">If the button does not work, use this link:</p>
          <p style="word-break:break-all;margin:0 0 12px;"><a href="${actionLink}">${actionLink}</a></p>
        </div>
      `,
    });

    if (!emailResult.sent) {
      return json(502, { error: 'Verification email delivery failed.', reason: emailResult.reason || 'unknown' });
    }

    try {
      await supabaseAdmin.from('email_notifications').insert({
        user_id: userId,
        email_type: 'account_verification',
        recipient_email: email,
        subject: 'Verify your Beezio email',
        content: 'Beezio custom signup verification email sent.',
        metadata: { redirectTo },
        sent_at: new Date().toISOString(),
        status: 'sent',
      } as any);
    } catch {
      // non-fatal
    }

    return json(200, { ok: true, sent: true });
  } catch (e: any) {
    return json(Number(e?.statusCode) || 500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
