import { afterEach, describe, expect, it, vi } from 'vitest';
import { deferredAuthListener } from './deferredAuthListener';
import { safePostAuthPath } from './storefrontScope';
afterEach(() => vi.useRealTimers());
describe('authentication without reentrant session locks', () => {
  it('returns before session-dependent work runs, allowing the auth lock to release', async () => {
    vi.useFakeTimers();
    let lockHeld = true;
    const handle = vi.fn(async () => { expect(lockHeld).toBe(false); });
    const listener = deferredAuthListener(handle);
    expect(listener.notify('SIGNED_IN', null)).toBeUndefined();
    expect(handle).not.toHaveBeenCalled();
    lockHeld = false;
    await vi.runAllTimersAsync();
    expect(handle).toHaveBeenCalledOnce();
  });
  it('cancels pending callbacks on provider unmount', async () => {
    vi.useFakeTimers();
    const handle = vi.fn(async () => {});
    const listener = deferredAuthListener(handle);
    listener.notify('INITIAL_SESSION', null);
    listener.dispose();
    await vi.runAllTimersAsync();
    expect(handle).not.toHaveBeenCalled();
  });
});
describe('order login destinations', () => {
  it('keeps the order tab and order identifier intact', () => {
    expect(safePostAuthPath('/account?tab=orders&order=123')).toBe('/account?tab=orders&order=123');
  });
  it.each(['/auth/login', '/auth/login?next=/account', '/account/login', '/account/signup', '//evil.example', '/\\evil.example'])('rejects loops and external destinations: %s', path => {
    expect(safePostAuthPath(path)).toBeNull();
  });
});
