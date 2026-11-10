import { describe, expect, it } from 'vitest';
import { buildReferralInviteMessage, buildSmsShareHref, MESSENGER_COMPOSE_URL, withRecruitCode } from './referralSharing';

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

describe('unified referral signup', () => {
  it.each(['/account/signup', '/signup'] as const)('passes the invite code from the chooser to %s', (path) => {
    const origin = 'https://beezio.co';
    const chooser = new URL(withRecruitCode('/join', '  example+code&other=yes  '), origin);
    const signup = new URL(withRecruitCode(path, chooser.searchParams.get('recruit')), origin);
    expect(chooser.pathname).toBe('/join');
    expect(signup.pathname).toBe(path);
    expect([...signup.searchParams.entries()]).toEqual([['recruit', 'example+code&other=yes']]);
  });

  it('keeps normal signup free of a referral parameter', () => {
    expect(withRecruitCode('/account/signup', null)).toBe('/account/signup');
    expect(withRecruitCode('/signup', '   ')).toBe('/signup');
  });
});
