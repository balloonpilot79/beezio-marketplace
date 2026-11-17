import { describe, expect, it } from 'vitest';
import { digitalDeliveryLabel, fulfillmentQueueBucket, isDigitalOnlyOrder } from './orderDelivery';

describe('digital fulfillment classification', () => {
  it('keeps an older digital purchase out of shipping even with a shipping default', () => {
    const order = { fulfillmentMethod: 'shipping', orderStatus: 'completed', items: [{ isDigital: true }] };
    expect(isDigitalOnlyOrder(order)).toBe(true);
    expect(fulfillmentQueueBucket(order)).toBe('digital');
  });
  it('keeps mixed orders and physical orders in the physical queue', () => {
    expect(fulfillmentQueueBucket({ items: [{ isDigital: true }, { isDigital: false }] })).toBe('needs_ordering');
    expect(fulfillmentQueueBucket({ items: [{ isDigital: false }], fulfillmentStatus: 'shipped' })).toBe('shipped');
    expect(fulfillmentQueueBucket({ items: [], fulfillmentMethod: 'shipping' })).toBe('needs_ordering');
  });
  it('does not claim a file was delivered just because payment completed', () => {
    expect(digitalDeliveryLabel(null)).toBe('Preparing download');
    expect(digitalDeliveryLabel({ access_status: 'pending' })).toBe('Download unavailable');
    expect(digitalDeliveryLabel({ access_status: 'active', download_count: 0 })).toBe('Download available');
    expect(digitalDeliveryLabel({ access_status: 'active', download_count: 1, download_limit: 5 })).toBe('Downloaded');
    expect(digitalDeliveryLabel({ access_status: 'active', download_count: 5, download_limit: 5 })).toBe('Download limit reached');
    expect(digitalDeliveryLabel({ access_status: 'revoked', download_count: 1 })).toBe('Download access revoked');
  });
});
