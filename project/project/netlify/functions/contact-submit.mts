import type { Config } from '@netlify/functions';
import { sendTransactionalEmail } from './_lib/email';

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export default async function contactSubmit(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const raw = await request.text();
    if (raw.length > 16000) return json(413, { error: 'Message is too large.' });
    let body: any;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'Invalid request.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'Invalid request.' });
    if (String(body.website || '').trim()) return json(400, { error: 'Please leave the website field empty.' });
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!name || name.length > 120 || /[\r\n]/.test(name)) return json(400, { error: 'Enter your name (up to 120 characters).' });
    if (email.length > 254 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)) return json(400, { error: 'Enter a valid email address.' });
    if (message.length < 10 || message.length > 4000) return json(400, { error: 'Enter a message between 10 and 4,000 characters.' });
    const result = await sendTransactionalEmail({
      to: 'support@beezio.co',
      replyTo: email,
      subject: `Beezio support request from ${name}`,
      html: `<h2>Beezio support request</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Reply email:</strong> ${escapeHtml(email)}</p><div style="white-space:pre-wrap">${escapeHtml(message)}</div>`,
    });
    if (!result.sent) return json(503, { error: 'We could not send your message right now. Please try again or email support@beezio.co.' });
    return json(200, { ok: true });
  } catch {
    return json(503, { error: 'We could not send your message right now. Please try again or email support@beezio.co.' });
  }
}

export const config: Config = {
  path: '/api/contact',
  method: 'POST',
  rateLimit: { aggregateBy: 'ip', action: 'rate_limit', windowSize: 60, windowLimit: 5 },
};
