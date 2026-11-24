import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), session: vi.fn(), resend: vi.fn(), navigate: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { verifyOtp: mocks.verify, getSession: mocks.session } } }));
vi.mock('../contexts/AuthContextMultiRole', () => ({ useAuth: () => ({ user: null, profile: null, resendVerificationEmail: mocks.resend }) }));
vi.mock('../services/transactionalEmailClient', () => ({ sendWelcomeEmail: vi.fn() }));
vi.mock('../services/signupVerificationClient', () => ({ confirmSignupEmail: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, Link: ({ children }: any) => <a>{children}</a> }));
import Page from './AuthConfirmPage';
import { sendWelcomeEmail } from '../services/transactionalEmailClient';
let view: ReactTestRenderer;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: vi.fn() });
  vi.stubGlobal('window', { location: { search: '?flow=signup&token_hash=test-hash&type=email', hash: '' }, setTimeout, clearTimeout, setInterval, clearInterval });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ createdProfile: false, role: 'buyer' }))));
  mocks.session.mockResolvedValue({ data: { session: null } });
});
afterEach(async () => { if (view) await act(async () => view.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('does not consume an emailed token when a link is merely opened or previewed', async () => {
  await act(async () => { view = create(<Page />); });
  expect(JSON.stringify(view.toJSON())).toContain('Confirm my email');
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it('verifies on an explicit click and completes the account only after confirmation', async () => {
  mocks.verify.mockResolvedValue({ data: { user: { id: 'test', email: 'test@example.test', email_confirmed_at: '2026-11-17', user_metadata: { role: 'buyer' } } }, error: null });
  await act(async () => { view = create(<Page />); });
  await act(async () => view.root.findAllByType('button').find(x => x.children.includes('Confirm my email'))!.props.onClick());
  expect(mocks.verify).toHaveBeenCalledExactlyOnceWith({ token_hash: 'test-hash', type: 'email' });
  expect(JSON.stringify(view.toJSON())).toContain('Email confirmed');
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => view.update(<Page />));
  expect(mocks.verify).toHaveBeenCalledTimes(1);
});
it('offers resend after a rejected link and never bootstraps an unverified account', async () => {
  mocks.verify.mockResolvedValue({ data: { user: null }, error: { message: 'Email link is invalid or has expired' } });
  await act(async () => { view = create(<Page />); });
  await act(async () => view.root.findAllByType('button').find(x => x.children.includes('Confirm my email'))!.props.onClick());
  expect(JSON.stringify(view.toJSON())).toContain('Resend verification email');
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => view.root.findByType('input').props.onChange({ target: { value: 'test@example.test' } }));
  await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  expect(mocks.resend).toHaveBeenCalledWith('test@example.test');
});
it('offers recovery for legacy links that arrive with an expired-token error', async () => {
  (window.location as any).search = '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  await act(async () => { view = create(<Page />); });
  expect(JSON.stringify(view.toJSON())).toContain('Resend verification email');
  expect(mocks.verify).not.toHaveBeenCalled();
});

it.each([
  ['buyer', '/account/login?next=%2Fdashboard%3Fsection%3Dbuyer'],
  ['seller', '/auth/login?next=%2Fdashboard'],
])('takes a confirmed %s without a session to sign-in for the matching guide', async (role, signInPath) => {
  mocks.verify.mockResolvedValue({ data: { user: {
    id: 'test', email: 'test@example.test', email_confirmed_at: '2026-11-24', user_metadata: { role },
  } }, error: null });
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
    createdProfile: true, usesSignupWelcomeGuide: true, role, welcomeEmail: { sent: true },
  })));
  await act(async () => { view = create(<Page />); });
  await act(async () => view.root.findAllByType('button').find(x => x.children.includes('Confirm my email'))!.props.onClick());
  expect(JSON.stringify(view.toJSON())).toContain('Sign in to see your welcome guide');
  expect(sendWelcomeEmail).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1400); });
  expect(mocks.navigate).toHaveBeenCalledWith(signInPath, { replace: true });
});
