import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestBusinessWelcome } from './businessWelcomeClient';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('welcome delivery recovery', () => {
  it('retries a provider failure and stops once accepted', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 502 }).mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetch);
    const pending = requestBusinessWelcome('session-token');
    await vi.runAllTimersAsync();
    expect(await pending).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith('/.netlify/functions/signup-welcome', expect.objectContaining({
      headers: { Authorization: 'Bearer session-token' },
    }));
  });
  it('does not retry an expired session', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetch);
    expect(await requestBusinessWelcome('expired')).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('bounds retries after a network outage', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetch);
    const pending = requestBusinessWelcome('token');
    await vi.runAllTimersAsync();
    expect(await pending).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
