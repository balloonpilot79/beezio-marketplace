import type { Config, Context } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { sendTransactionalEmail } from './_lib/email';

declare const Netlify: {
  env: { get(name: string): string | undefined };
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const publicResponse = {
  ok: true,
  message: 'If a Beezio account uses that email, a password reset message is on its way.',
};

export default async (request: Request, _context: Context) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let email = '';
  try {
    const body = (await request.json()) as { email?: string };
    email = String(body?.email || '').trim().toLowerCase();
  } catch {
    return json(400, { error: 'Invalid request body.' });
  }

  if (!email || !email.includes('@')) {
    return json(400, { error: 'Enter a valid email address.' });
  }

  try {
    const siteUrl = String(
      Netlify.env.get('SITE_URL') || Netlify.env.get('URL') || 'https://beezio.co'
    ).trim().replace(/\/$/, '');
    const redirectTo = `${siteUrl}/reset-password?type=recovery`;
    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (error) {
      console.warn('[password-reset-request] recovery link was not generated:', error.message);
      return json(200, publicResponse);
    }

    const actionLink = String(
      (data as any)?.properties?.action_link || (data as any)?.action_link || ''
    ).trim();
    if (!actionLink) {
      console.warn('[password-reset-request] recovery link was empty');
      return json(200, publicResponse);
    }

    const result = await sendTransactionalEmail({
      to: email,
      subject: 'Reset your Beezio password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;">
          <div style="background:#f59e0b;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
            <h1 style="margin:0;font-size:28px;">Beezio</h1>
          </div>
          <div style="border:1px solid #fde68a;border-top:0;border-radius:0 0 12px 12px;padding:28px;">
            <h2 style="margin:0 0 12px;">Reset your Beezio password</h2>
            <p style="margin:0 0 20px;line-height:1.6;">We received a request to reset the password for ${escapeHtml(email)}.</p>
            <p style="margin:0 0 20px;"><a href="${escapeHtml(actionLink)}" style="display:inline-block;background:#111827;color:#fbbf24;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">Reset Beezio Password</a></p>
            <p style="margin:0 0 8px;line-height:1.6;">If you did not request this, you can safely ignore this email.</p>
            <p style="margin:18px 0 0;font-size:12px;word-break:break-all;color:#6b7280;">${escapeHtml(actionLink)}</p>
          </div>
        </div>
      `,
    });

    if (!result.sent) {
      console.warn('[password-reset-request] Beezio email delivery failed:', result.reason || 'unknown');
    }
  } catch (error) {
    console.error('[password-reset-request] unexpected failure:', error);
  }

  return json(200, publicResponse);
};

export const config: Config = {
  path: '/api/auth/password-reset/request',
  method: ['POST'],
};
