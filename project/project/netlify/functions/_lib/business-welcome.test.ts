import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBusinessWelcomeEmail, sendBusinessWelcome } from './business-welcome';
import { sendTransactionalEmail } from './email';

vi.mock('./email', () => ({ sendTransactionalEmail: vi.fn() }));

function fixture(roles = ['seller', 'affiliate', 'influencer']) {
  const user: any = {
    id: 'signup-user', email: 'business@example.com',
    created_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString(),
    user_metadata: { full_name: 'New Business' }, app_metadata: { provider: 'email' },
  };
  const query: any = { select: () => query, eq: () => query, then: (resolve: any) => Promise.resolve({ data: roles.map(role => ({ role })) }).then(resolve) };
  const updateUserById = vi.fn(async (_id, changes) => {
    Object.assign(user, changes);
    return { data: { user }, error: null };
  });
  const db: any = {
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user }, error: null })), updateUserById } },
    from: vi.fn(() => query),
  };
  return { user, db, updateUserById };
}

beforeEach(() => { vi.clearAllMocks(); vi.mocked(sendTransactionalEmail).mockResolvedValue({ sent: true }); });

describe('automatic business welcome tutorial', () => {
  it.each(['seller', 'affiliate', 'influencer'])('sends the tutorial for a new %s using the registered email', async role => {
    const { user, db, updateUserById } = fixture([role]);
    expect(await sendBusinessWelcome(db, user)).toEqual({ sent: true });
    expect(sendTransactionalEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: user.email, from: 'Beezio Welcome <welcome@beezio.co>', replyTo: 'support@beezio.co',
      idempotencyKey: 'business-welcome/signup-user',
    }));
    expect(updateUserById).toHaveBeenCalledWith(user.id, expect.objectContaining({
      app_metadata: expect.objectContaining({ provider: 'email', business_welcome_sent_at: expect.any(String) }),
    }));
  });
  it('does not send twice when confirmation is followed by account bootstrap', async () => {
    const { user, db } = fixture();
    const staleSnapshot = structuredClone(user);
    await sendBusinessWelcome(db, user);
    expect(await sendBusinessWelcome(db, staleSnapshot)).toEqual({ sent: false, reason: 'already_sent' });
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });
  it('does not treat a user-editable role as a business grant', async () => {
    const { user, db } = fixture(['buyer']);
    user.user_metadata.role = 'seller';
    expect(await sendBusinessWelcome(db, user)).toEqual({ sent: false, reason: 'not_business' });
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
  it('does not email unconfirmed or older accounts', async () => {
    const { user, db } = fixture();
    user.email_confirmed_at = null;
    expect((await sendBusinessWelcome(db, user)).reason).toBe('unconfirmed');
    user.email_confirmed_at = new Date().toISOString();
    user.created_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect((await sendBusinessWelcome(db, user)).reason).toBe('not_new_signup');
    expect(sendTransactionalEmail).not.toHaveBeenCalled();
  });
  it('allows a failed delivery to retry without marking it sent', async () => {
    const { user, db, updateUserById } = fixture();
    vi.mocked(sendTransactionalEmail).mockResolvedValueOnce({ sent: false, reason: 'provider_error' });
    expect((await sendBusinessWelcome(db, user)).sent).toBe(false);
    expect(updateUserById).not.toHaveBeenCalled();
    expect((await sendBusinessWelcome(db, user)).sent).toBe(true);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(2);
  });
  it('escapes names and includes real dashboard actions for all business roles', () => {
    const { html } = buildBusinessWelcomeEmail('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    for (const label of ['Customize My Store', 'Seller', 'Affiliate', 'Ambassador', 'Add to My Store', 'Financials', 'support@beezio.co']) expect(html).toContain(label);
    expect(html).not.toContain('Stripe');
  });
});
