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

export function withRecruitCode(path: '/join' | '/account/signup' | '/signup' | '/signup?intent=sell' | '/signup?intent=earn', code: string | null | undefined): string {
  const cleanCode = code?.trim();
  const separator = path.includes('?') ? '&' : '?';
  return cleanCode ? `${path}${separator}${new URLSearchParams({ recruit: cleanCode })}` : path;
}

export function buildAmbassadorPrintInvite(code: string): string {
  const cleanCode = code.trim();
  return cleanCode ? `https://beezio.co/i/${encodeURIComponent(cleanCode)}?intent=sell` : '';
}

export function getRecruitSignupPath(code: string | undefined, intent: string | null): string {
  const cleanCode = code?.trim();
  if (intent !== 'sell' || !cleanCode) return withRecruitCode('/join', cleanCode);
  return `/signup?${new URLSearchParams({ intent: 'sell', recruit: cleanCode })}`;
}
