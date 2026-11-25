import { describe, expect, it } from 'vitest';
import { reviewDeliveryDate, reviewDeliveryWindows } from './customerReviewDelivery';

describe('Google Customer Reviews delivery dates', () => {
  const friday = '2026-11-20T18:00:00Z';

  it('uses the payment date for an instant download', () => {
    const windows = reviewDeliveryWindows([{ is_digital: true }], false);
    expect(reviewDeliveryDate(friday, windows ?? undefined)).toBe('2026-11-20');
  });

  it('uses the latest item estimate and includes seller handling time', () => {
    const windows = reviewDeliveryWindows([
      { is_digital: true },
      { shipping_options: [{ processing_time: '1–2 business days before shipping', estimated_days: '2-3 days' }] },
      { shipping_options: [{ estimated_days: '2 business days' }] },
    ], false);
    expect(reviewDeliveryDate(friday, windows ?? undefined)).toBe('2026-11-27');
  });

  it('requires a usable preparation estimate for pickup', () => {
    expect(reviewDeliveryWindows([{}], true)).toBeNull();
    const windows = reviewDeliveryWindows([{ shipping_options: [{ processing_time: '2 days' }] }], true);
    expect(reviewDeliveryDate(friday, windows ?? undefined)).toBe('2026-11-22');
  });

  it('uses the selected carrier window when the seller has no estimate', () => {
    const windows = reviewDeliveryWindows([{}], false, '7-10 days');
    expect(reviewDeliveryDate(friday, windows ?? undefined)).toBe('2026-11-30');
  });
});
