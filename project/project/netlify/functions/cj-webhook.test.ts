import { describe, expect, it } from 'vitest';
import { extractCJOrderUpdate } from './_lib/cj-order-status';
import { computeCJWebhookSignature, verifyCJWebhookSignature } from './cj-webhook';

describe('CJ webhook contract', () => {
  it('matches CJ official HMAC-SHA256 Base64 example', () => {
    const raw = '{"messageId":"123111","messageType":"INSERT","params":"123","type":"PRODUCT"}';
    const expected = 'AHxoGFMoS/4mZfJ5vFes5//Pz2QibFQhh3GlrTtnWpk=';
    expect(computeCJWebhookSignature(raw, '123')).toBe(expected);
    expect(verifyCJWebhookSignature(raw, expected, '123')).toBe(true);
    expect(verifyCJWebhookSignature(`${raw} `, expected, '123')).toBe(false);
  });

  it('normalizes current ORDER webhook params', () => {
    const update = extractCJOrderUpdate({
      type: 'ORDER',
      params: {
        cjOrderId: 'CJ-1',
        orderNumber: 'BZO-1',
        orderStatus: 'SHIPPED',
        logisticName: 'CJPacket',
        trackNumber: 'TRACK-1',
        trackingUrl: 'https://tracking.example/1',
      },
    });
    expect(update).toMatchObject({
      cjOrderId: 'CJ-1',
      orderNumber: 'BZO-1',
      status: 'shipped',
      logisticName: 'CJPacket',
      trackingNumber: 'TRACK-1',
    });
  });

  it('maps delivered LOGISTIC updates', () => {
    const update = extractCJOrderUpdate({
      type: 'LOGISTIC',
      params: {
        orderId: 'CJ-2',
        storeOrderNumbers: ['BZO-2'],
        trackingNumber: 'TRACK-2',
        trackingStatus: 12,
      },
    });
    expect(update.cjOrderId).toBe('CJ-2');
    expect(update.orderNumber).toBe('BZO-2');
    expect(update.status).toBe('delivered');
  });
});
