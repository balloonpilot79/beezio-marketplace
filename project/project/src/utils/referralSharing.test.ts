import { describe, expect, it } from 'vitest';
import { buildReferralInviteMessage, buildSmsShareHref, MESSENGER_COMPOSE_URL } from './referralSharing';

describe('referral sharing', () => {
  const message = 'Join Beezio through my invite.';
  const referralUrl = 'https://beezio.co/i/jason?source=invite';

  it('keeps the tracked referral URL in the invite message', () => {
    expect(buildReferralInviteMessage(message, referralUrl)).toBe(`${message}\n\n${referralUrl}`);
  });

  it('builds an iPhone SMS compose link with the tracked referral URL', () => {
    const href = buildSmsShareHref(message, referralUrl, 'Mozilla/5.0 (iPhone)');
    expect(href).toBe(`sms:&body=${encodeURIComponent(`${message}\n\n${referralUrl}`)}`);
  });

  it('builds an Android SMS compose link with the tracked referral URL', () => {
    const href = buildSmsShareHref(message, referralUrl, 'Mozilla/5.0 (Linux; Android 15)');
    expect(href).toBe(`sms:?body=${encodeURIComponent(`${message}\n\n${referralUrl}`)}`);
  });

  it('uses Messenger compose for direct messages', () => {
    expect(MESSENGER_COMPOSE_URL).toBe('https://www.messenger.com/new');
  });
});
