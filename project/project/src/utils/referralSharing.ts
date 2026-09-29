export const MESSENGER_COMPOSE_URL = 'https://www.messenger.com/new';

export function buildReferralInviteMessage(message: string, referralUrl: string): string {
  const cleanMessage = String(message || '').trim();
  const cleanUrl = String(referralUrl || '').trim();

  return [cleanMessage, cleanUrl].filter(Boolean).join('\n\n');
}

export function buildSmsShareHref(
  message: string,
  referralUrl: string,
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): string {
  const body = encodeURIComponent(buildReferralInviteMessage(message, referralUrl));
  const separator = /iPad|iPhone|iPod/i.test(userAgent) ? '&' : '?';
  return `sms:${separator}body=${body}`;
}
