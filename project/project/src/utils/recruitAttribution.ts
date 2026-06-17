const PENDING_RECRUIT_ATTRIBUTION_KEY = 'beezio_pending_recruit_attribution_v1';
const MAX_PENDING_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type PendingRecruitAttribution = {
  userId: string;
  referrerProfileId: string;
  recruitedRole: 'seller' | 'affiliate';
  createdAt: number;
};

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function readPending(): PendingRecruitAttribution | null {
  try {
    const raw = localStorage.getItem(PENDING_RECRUIT_ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingRecruitAttribution;
    const userId = String(parsed?.userId || '').trim();
    const referrerProfileId = String(parsed?.referrerProfileId || '').trim();
    const recruitedRole = String(parsed?.recruitedRole || '').trim().toLowerCase();
    const createdAt = Number(parsed?.createdAt || 0);
    if (
      !isUuid(userId) ||
      !isUuid(referrerProfileId) ||
      (recruitedRole !== 'seller' && recruitedRole !== 'affiliate') ||
      !Number.isFinite(createdAt) ||
      createdAt <= 0
    ) {
      return null;
    }
    if (Date.now() - createdAt > MAX_PENDING_AGE_MS) {
      return null;
    }
    return { userId, referrerProfileId, recruitedRole: recruitedRole as 'seller' | 'affiliate', createdAt };
  } catch {
    return null;
  }
}

export function queuePendingRecruitAttribution(userId: string, referrerProfileId: string, recruitedRole: 'seller' | 'affiliate') {
  const uid = String(userId || '').trim();
  const rid = String(referrerProfileId || '').trim();
  const role = String(recruitedRole || '').trim().toLowerCase();
  if (!isUuid(uid) || !isUuid(rid) || uid === rid || (role !== 'seller' && role !== 'affiliate')) return;
  try {
    const payload: PendingRecruitAttribution = {
      userId: uid,
      referrerProfileId: rid,
      recruitedRole: role as 'seller' | 'affiliate',
      createdAt: Date.now(),
    };
    localStorage.setItem(PENDING_RECRUIT_ATTRIBUTION_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function getPendingRecruitAttributionForUser(userId: string): PendingRecruitAttribution | null {
  const pending = readPending();
  if (!pending) return null;
  if (String(pending.userId || '').trim() !== String(userId || '').trim()) return null;
  return pending;
}

export function clearPendingRecruitAttributionForUser(userId: string) {
  const pending = readPending();
  if (!pending) return;
  if (String(pending.userId || '').trim() !== String(userId || '').trim()) return;
  try {
    localStorage.removeItem(PENDING_RECRUIT_ATTRIBUTION_KEY);
  } catch {
    // ignore storage errors
  }
}

