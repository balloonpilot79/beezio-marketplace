import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./_lib/email', () => ({ sendTransactionalEmail: vi.fn() }));
import { sendTransactionalEmail } from './_lib/email';
import contactSubmit from './contact-submit.mts';
const send = vi.mocked(sendTransactionalEmail);
const valid = { name: 'Shopper', email: 'shopper@example.com', message: 'Please help me with my order.', website: '' };
const post = (body: unknown) => contactSubmit(new Request('https://beezio.co/api/contact', { method: 'POST', body: JSON.stringify(body) }));
beforeEach(() => { send.mockReset(); send.mockResolvedValue({ sent: true }); });
describe('public support form', () => {
  it('sends only to support and allows staff to reply to the visitor', async () => {
    expect((await post({ ...valid, to: 'unrelated@example.com' })).status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'support@beezio.co', replyTo: valid.email }));
  });
  it.each([{ email: 'invalid' }, { email: 'person@example.com\nBcc: other@example.com' }, { message: 'short' }, { name: '' }, { website: 'spam' }])('rejects invalid or automated submissions without sending: %j', async override => {
    expect((await post({ ...valid, ...override })).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('escapes submitted HTML instead of inserting it into the support message', async () => {
    await post({ ...valid, message: '<script>alert("test")</script>' });
    expect(send.mock.calls[0][0].html).toContain('&lt;script&gt;');
    expect(send.mock.calls[0][0].html).not.toContain('<script>');
  });
  it('reports failure without promising a successful message', async () => {
    send.mockResolvedValue({ sent: false, reason: 'provider_error' });
    const response = await post(valid);
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('ok', true);
  });
  it('rejects oversized requests and non-POST methods', async () => {
    expect((await post({ ...valid, message: 'x'.repeat(17000) })).status).toBe(413);
    expect((await contactSubmit(new Request('https://beezio.co/api/contact'))).status).toBe(405);
    expect(send).not.toHaveBeenCalled();
  });
});
