import { describe, expect, it } from 'vitest';
import { getPayoutCutoffIso, getScheduledPaydayOnOrAfter, isSupportedPayday, resolveRequestedPayoutDate } from './payoutSchedule';

describe('payoutSchedule', () => {
  it('keeps the final millisecond of a winter Chicago payday exact', () => {
    expect(getPayoutCutoffIso('2026-01-15', 'America/Chicago')).toBe('2026-01-16T05:59:59.999Z');
  });
  it('keeps the final millisecond of a summer Chicago payday exact', () => {
    expect(getPayoutCutoffIso('2026-07-15', 'America/Chicago')).toBe('2026-07-16T04:59:59.999Z');
  });
  it('accepts only the 1st and 15th', () => {
    expect(isSupportedPayday('2026-02-01')).toBe(true);
    expect(isSupportedPayday('2026-02-15')).toBe(true);
    expect(isSupportedPayday('2026-02-28')).toBe(false);
    expect(isSupportedPayday('2026-04-30')).toBe(false);
  });
  it('routes matured earnings to the next 1st-or-15th payday', () => {
    expect(getScheduledPaydayOnOrAfter('2026-07-14T12:00:00.000Z', 'America/Chicago')).toBe('2026-07-15');
    expect(getScheduledPaydayOnOrAfter('2026-07-16T12:00:00.000Z', 'America/Chicago')).toBe('2026-08-01');
  });
  it('rejects unsupported manual payout dates', () => {
    expect(() => resolveRequestedPayoutDate('2026-07-20')).toThrow(/1st and 15th/i);
  });
});
