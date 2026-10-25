import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AffiliateShareWidget from './AffiliateShareWidget';
import SocialShareButton from './SocialShareButton';

const state = vi.hoisted(() => ({ auth: {} as any, trackShare: vi.fn() }));
vi.mock('../contexts/AuthContextMultiRole', () => ({ useAuth: () => state.auth }));
vi.mock('../hooks/useBehaviorTracker', () => ({ useBehaviorTracker: () => ({ trackShare: state.trackShare }) }));
vi.mock('./SocialMediaTemplates', () => ({ default: () => null }));
vi.mock('./QRCodeShare', () => ({ default: () => null }));
let view: ReactTestRenderer;
let popup: any;
const assign = vi.fn();
const open = vi.fn();
const text = (n: any): string => typeof n === 'string' ? n : (n.children || []).map(text).join('');
const click = async (label: string) => { await act(async () => { await view.root.findAllByType('button').find(n => text(n) === label)!.props.onClick(); }); };
const mount = async (element: React.ReactElement) => { await act(async () => { view = create(element); }); };
beforeEach(() => {
  vi.clearAllMocks();
  popup = { opener: {}, closed: false, location: { href: '' }, close: vi.fn() };
  open.mockReturnValue(popup);
  state.auth = { user: null, session: null, profile: null, hasRole: () => false };
  state.trackShare.mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('window', { open, location: { origin: 'https://beezio.co', assign }, setTimeout });
  vi.stubGlobal('navigator', { userAgent: 'iPhone' });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(async () => { if (view) await act(async () => view.unmount()); vi.unstubAllGlobals(); });
const widget = <AffiliateShareWidget type="product" targetId="p1" targetPath="/store/redtail/product/p1" />;
const product = { id: 'p1', title: 'Blanket', price: 29.99, images: [] };

describe('sharing failure regressions', () => {
  it('navigates the reserved Facebook tab and keeps Beezio open', async () => {
    await mount(widget); await click('Facebook');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][2]).not.toContain('noopener');
    expect(popup.opener).toBeNull();
    expect(new URL(popup.location.href).searchParams.get('u')).toBe('https://beezio.co/store/redtail/product/p1');
    expect(assign).not.toHaveBeenCalled();
  });
  it('preserves affiliate attribution without waiting for analytics', async () => {
    state.auth = { user: { id: 'u1' }, session: { access_token: 'test-token' }, profile: { id: 'a1' }, hasRole: () => true };
    vi.mocked(fetch).mockImplementation((url: any) => url === '/api/affiliate/link' ? Promise.resolve({ ok: true, text: async () => JSON.stringify({ trackedUrl: 'https://beezio.co/product/p1?ref=partner&code=partner' }) } as any) : new Promise(() => {}));
    await mount(widget); await click('Facebook');
    expect(new URL(popup.location.href).searchParams.get('u')).toContain('ref=partner&code=partner');
  });
  it('prevents sharing and offers retry when attribution cannot be generated', async () => {
    state.auth = { user: { id: 'u1' }, session: { access_token: 'test-token' }, profile: {}, hasRole: () => true };
    vi.mocked(fetch).mockRejectedValue(new Error('Offline'));
    await mount(widget);
    expect(view.root.findAllByType('button').find(n => text(n) === 'Facebook')!.props.disabled).toBe(true);
    expect(text(view.root)).toContain('Retry affiliate link');
    expect(open).not.toHaveBeenCalled();
    expect(text(view.root)).toContain('Could not create your affiliate link');
    expect(assign).not.toHaveBeenCalled();
  });
  it('falls back to the share URL if popups are blocked', async () => {
    open.mockReturnValue(null); await mount(widget); await click('Facebook');
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('facebook.com/sharer/'));
  });
  it('uses an iPhone SMS body link', async () => {
    await mount(widget); await click('SMS');
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^sms:&body=/));
  });
  it('renders the icon share menu when native sharing is unavailable and opens before analytics', async () => {
    await mount(<SocialShareButton product={product} variant="icon" affiliateCode="partner" />);
    await act(async () => { await view.root.findByProps({ title: 'Share product' }).props.onClick(); });
    await click('Facebook');
    expect(new URL(popup.location.href).searchParams.get('u')).toContain('ref=partner');
    expect(state.trackShare).toHaveBeenCalledWith('p1', 'facebook');
  });
  it('opens the fallback menu on a native-share failure', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('Unavailable')) });
    await mount(<SocialShareButton product={product} variant="icon" />);
    await act(async () => { await view.root.findByProps({ title: 'Share product' }).props.onClick(); });
    expect(text(view.root)).toContain('Share Product');
  });
  it('does not open the fallback menu after the user cancels native sharing', async () => {
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(Object.assign(new Error('Cancelled'), { name: 'AbortError' })) });
    await mount(<SocialShareButton product={product} variant="icon" />);
    await act(async () => { await view.root.findByProps({ title: 'Share product' }).props.onClick(); });
    expect(text(view.root)).not.toContain('Share Product');
  });
});
