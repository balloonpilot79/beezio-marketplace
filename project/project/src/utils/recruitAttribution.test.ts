import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingRecruitAttributionForUser,
  getPendingRecruitAttributionsForUser,
  queuePendingRecruitAttribution,
} from './recruitAttribution';

const userId = '11111111-1111-4111-8111-111111111111';
const influencerId = '22222222-2222-4222-8222-222222222222';

describe('recruitAttribution', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key),
    });
  });

  it('keeps both seller and affiliate lifetime assignments for one business signup', () => {
    queuePendingRecruitAttribution(userId, influencerId, 'seller');
    queuePendingRecruitAttribution(userId, influencerId, 'affiliate');

    expect(getPendingRecruitAttributionsForUser(userId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recruitedRole: 'seller', referrerProfileId: influencerId }),
        expect.objectContaining({ recruitedRole: 'affiliate', referrerProfileId: influencerId }),
      ])
    );
    expect(getPendingRecruitAttributionsForUser(userId)).toHaveLength(2);
  });

  it('replaces only the matching role and clears every assignment for the completed user', () => {
    queuePendingRecruitAttribution(userId, influencerId, 'seller');
    queuePendingRecruitAttribution(userId, influencerId, 'seller');
    queuePendingRecruitAttribution(userId, influencerId, 'affiliate');

    expect(getPendingRecruitAttributionsForUser(userId)).toHaveLength(2);
    clearPendingRecruitAttributionForUser(userId);
    expect(getPendingRecruitAttributionsForUser(userId)).toEqual([]);
  });
});
