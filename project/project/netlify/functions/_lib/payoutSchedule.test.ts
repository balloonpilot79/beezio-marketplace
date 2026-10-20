import { describe, expect, it } from 'vitest';
import { getPayoutCutoffIso, getScheduledPaydayOnOrAfter, isSupportedPayday, resolveRequestedPayoutDate } from './payoutSchedule';

describe('payoutSchedule', () => {
  it('keeps the final millisecond of a winter Chicago payday exact', () => {
    expect(getPayoutCutoffIso('2026-01-15', 'America/Chicago')).toBe('2026-01-16T05:59:59.999Z');
  });
  it('keeps the final millisecond of a summer Chicago payday exact', () => {
    expect(getPayoutCutoffIso('2026-07-15', 'America/Chicago')).toBe('2026-07-16T04:59:59.999Z');
  });
  it('accepts the 15th and the actual final day of each month', () => {
    expect(isSupportedPayday('2026-02-01')).toBe(false);
    expect(isSupportedPayday('2026-02-15')).toBe(true);
    expect(isSupportedPayday('2026-02-28')).toBe(true);
    expect(isSupportedPayday('2026-04-30')).toBe(true);
    expect(isSupportedPayday('2026-12-31')).toBe(true);
    expect(isSupportedPayday('2028-02-29')).toBe(true);
    expect(isSupportedPayday('2028-02-28')).toBe(false);
  });
  it('rejects invalid calendar dates', () => {
    for (const date of ['2026-02-29', '2026-04-31', '2026-13-15', '2026-00-15', '2026-02-00']) {
      expect(isSupportedPayday(date)).toBe(false);
      expect(() => resolveRequestedPayoutDate(date)).toThrow();
    }
  });
  it('routes matured earnings to the next 15th-or-month-end payday', () => {
    expect(getScheduledPaydayOnOrAfter('2026-07-14T12:00:00.000Z', 'America/Chicago')).toBe('2026-07-15');
    expect(getScheduledPaydayOnOrAfter('2026-07-16T12:00:00.000Z', 'America/Chicago')).toBe('2026-07-31');
    expect(getScheduledPaydayOnOrAfter('2026-12-31T12:00:00.000Z', 'America/Chicago')).toBe('2026-12-31');
    expect(getScheduledPaydayOnOrAfter('2027-01-01T12:00:00.000Z', 'America/Chicago')).toBe('2027-01-15');
    expect(getScheduledPaydayOnOrAfter('2028-02-16T12:00:00.000Z', 'America/Chicago')).toBe('2028-02-29');
  });
  it('uses the Chicago date across the UTC month boundary', () => {
    expect(getScheduledPaydayOnOrAfter('2026-08-01T02:00:00.000Z', 'America/Chicago')).toBe('2026-07-31');
    expect(getScheduledPaydayOnOrAfter('2026-08-01T06:00:00.000Z', 'America/Chicago')).toBe('2026-08-15');
  });
  it('rejects unsupported manual payout dates', () => {
    expect(() => resolveRequestedPayoutDate('2026-07-20')).toThrow(/15th and last calendar day/i);
  });
});
