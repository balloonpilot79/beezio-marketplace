import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_CJ_WEBHOOK_CALLBACK_URL,
  buildCJWebhookSettingsPayload,
  normalizeCJProductSubscriptionIds,
  resolveCJWebhookCallbackUrl,
} from './cj-api';
import { isCJProductSubscriptionCurrent } from './cj-webhook-subscriptions';

const originalCallbackUrl = process.env.CJ_WEBHOOK_CALLBACK_URL;

afterEach(() => {
  if (originalCallbackUrl === undefined) delete process.env.CJ_WEBHOOK_CALLBACK_URL;
  else process.env.CJ_WEBHOOK_CALLBACK_URL = originalCallbackUrl;
});

describe('CJ webhook configuration', () => {
  it('enables the four Beezio fulfillment topics at one HTTPS callback', () => {
    const callbackUrl = 'https://beezio.co/.netlify/functions/cj-webhook';
    expect(buildCJWebhookSettingsPayload(callbackUrl)).toEqual({
      product: { type: 'ENABLE', callbackUrls: [callbackUrl] },
      stock: { type: 'ENABLE', callbackUrls: [callbackUrl] },
      order: { type: 'ENABLE', callbackUrls: [callbackUrl] },
      logistics: { type: 'ENABLE', callbackUrls: [callbackUrl] },
    });
  });

  it('uses Beezio production as the default callback', () => {
    delete process.env.CJ_WEBHOOK_CALLBACK_URL;
    expect(resolveCJWebhookCallbackUrl()).toBe(DEFAULT_CJ_WEBHOOK_CALLBACK_URL);
  });

  it('rejects local or non-HTTPS callback URLs', () => {
    process.env.CJ_WEBHOOK_CALLBACK_URL = 'http://localhost:8888/cj-webhook';
    expect(() => resolveCJWebhookCallbackUrl()).toThrow(/public HTTPS URL/);
  });

  it('deduplicates and cleans specific product IDs without subscribe-all', () => {
    expect(normalizeCJProductSubscriptionIds([' pid-1 ', 'pid-1', '', null, 'pid-2'])).toEqual([
      'pid-1',
      'pid-2',
    ]);
  });

  it('only treats a confirmed subscription for the current callback as current', () => {
    const callbackUrl = 'https://beezio.co/.netlify/functions/cj-webhook';
    expect(isCJProductSubscriptionCurrent({
      cj_webhook_subscription: { status: 'subscribed', callback_url: callbackUrl },
    }, callbackUrl)).toBe(true);
    expect(isCJProductSubscriptionCurrent({
      cj_webhook_subscription: { status: 'failed', callback_url: callbackUrl },
    }, callbackUrl)).toBe(false);
    expect(isCJProductSubscriptionCurrent({
      cj_webhook_subscription: { status: 'subscribed', callback_url: 'https://old.example/webhook' },
    }, callbackUrl)).toBe(false);
  });
});
