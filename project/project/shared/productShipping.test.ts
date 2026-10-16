import { describe, expect, it } from 'vitest';
import { getProductShippingTiming } from './productShipping';

describe('item-specific shipping timing', () => {
  it('keeps different seller estimates and processing times separate', () => {
    const madeToOrder = getProductShippingTiming({ shipping_options: [{ estimated_days: '5–8 business days', processing_time: '3–6 business days', origin_country: 'US' }] });
    const readyToShip = getProductShippingTiming({ shipping_options: [{ estimated_days: '1–2 business days', processing_time: 'Same day' }] });
    expect(madeToOrder).toMatchObject({ estimated_days: '5–8 business days', processing_time: '3–6 business days', origin_country: 'US' });
    expect(readyToShip).toMatchObject({ estimated_days: '1–2 business days', processing_time: 'Same day' });
  });
  it('reads legacy JSON options and trims seller input', () => {
    expect(getProductShippingTiming({ shipping_options: JSON.stringify([{ days: ' 7–14 days ', processing_time: ' 2 days ' }]) })).toMatchObject({ estimated_days: '7–14 days', processing_time: '2 days' });
  });
  it('does not invent a delivery promise for missing or malformed options', () => {
    for (const shipping_options of [undefined, [], 'invalid', '{}', [{}], [{ estimated_days: '' }]]) {
      expect(getProductShippingTiming({ shipping_options })).toMatchObject({ estimated_days: '', processing_time: '' });
    }
  });
});
