import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPayPalConnectState, verifyPayPalConnectState, getVerifiedPayPalIdentity, safePayPalReturnPath } from '../netlify/functions/_lib/paypalConnect';
const mocks = vi.hoisted(() => ({ save: vi.fn(), select: vi.fn() }));
vi.mock('../netlify/functions/_lib/auth', () => ({
  extractAuthHeader: (e: any) => e.headers.authorization || '',
  getAuthedUser: vi.fn(async () => ({ user: { id: 'user-1' }, error: null })),
  resolveProfileId: vi.fn(async () => 'profile-1'),
}));
vi.mock('../netlify/functions/_lib/paypal', () => ({ getPayPalBaseUrl: async () => 'https://api-m.paypal.com', isPayPalEnabled: () => true }));
vi.mock('../netlify/functions/_lib/supabase', () => ({ createSupabaseAdmin: () => ({ from: () => ({ upsert: mocks.save }) }) }));
import { handler } from '../netlify/functions/paypal-connect-complete';
import { handler as start } from '../netlify/functions/paypal-connect-start';
const secret = 'test-only-secret';
const identity = { sub: 'paypal-user', email: ' Verified@Example.com ', email_verified: true };
const roles = ['SELLER','PARTNER','INFLUENCER'];
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv('PAYPAL_CLIENT_ID', 'test-client'); vi.stubEnv('PAYPAL_CLIENT_SECRET', secret);
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); mocks.save.mockReset(); mocks.select.mockReset();
  mocks.save.mockReturnValue({ select: mocks.select });
  mocks.select.mockResolvedValue({ data: roles.map(role => ({role, paypal_email:'verified@example.com',is_verified:true})), error:null });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function event(body: any, authorization = 'Bearer session') { return { httpMethod:'POST', headers:{ authorization }, body:JSON.stringify(body) } as any; }
async function finish() {
  const { state, nonce } = createPayPalConnectState('user-1','/dashboard',secret);
  return await handler(event({ code:'one-use-code',state,expected_nonce:nonce }), {} as any, (()=>{}) as any) as any;
}
describe('PayPal connection security and verification', () => {
  it('signs and binds state to the user, nonce, age, and local return path', () => {
    const {state,nonce}=createPayPalConnectState('user-1','/dashboard?tab=payouts',secret,1000);
    expect(verifyPayPalConnectState(state,nonce,'user-1',secret,1001).returnTo).toBe('/dashboard?tab=payouts');
    for (const [raw,n,u,s,t] of [[state,nonce,'other',secret,1001],[state,'wrong','user-1',secret,1001],[state,nonce,'user-1','wrong',1001],[state,nonce,'user-1',secret,999],[state,nonce,'user-1',secret,901001],[state+'x',nonce,'user-1',secret,1001]] as const)
      expect(()=>verifyPayPalConnectState(raw,n,u,s,t)).toThrow();
  });
  it.each(['//evil.com','/\\evil.com','https://evil.com','/\nevil.com'])('rejects unsafe return path %s', p => expect(safePayPalReturnPath(p)).toBe('/dashboard'));
  it('starts a signed flow at PayPal with the fixed callback and email scope', async () => {
    const result:any = await start(event({return_to:'/dashboard'}),{} as any,(()=>{}) as any);
    const body=JSON.parse(result.body), url=new URL(body.authUrl);
    expect(url.origin).toBe('https://www.paypal.com'); expect(url.pathname).toBe('/connect');
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.get('redirect_uri')).toBe('https://beezio.co/paypal/connect/callback');
    expect(verifyPayPalConnectState(url.searchParams.get('state')!,body.nonce,'user-1',secret).returnTo).toBe('/dashboard');
  });
  it('requires authentication before start or completion', async () => {
    expect((await start(event({},''),{} as any,(()=>{}) as any) as any).statusCode).toBe(401);
    expect((await handler(event({},''),{} as any,(()=>{}) as any) as any).statusCode).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects unsigned old state before contacting PayPal', async () => {
    const result:any=await handler(event({code:'code',state:Buffer.from('{}').toString('base64url'),expected_nonce:'n'}),{} as any,(()=>{}) as any);
    expect(result.statusCode).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it('uses authenticated PayPal userinfo and verifies all three saved roles', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({access_token:'identity-token'})))
      .mockResolvedValueOnce(new Response(JSON.stringify(identity)));
    const result=await finish(); expect(result.statusCode).toBe(200); expect(JSON.parse(result.body).emailVerified).toBe(true);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api-m.paypal.com/v1/identity/openidconnect/userinfo?schema=openid');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer identity-token');
    expect(mocks.save.mock.calls[0][0]).toEqual(roles.map(role=>({user_id:'profile-1',role,paypal_email:'verified@example.com',is_verified:true})));
  });
  it.each([false,undefined,'true','false'])('does not save unverified identity (%s)', async email_verified => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({access_token:'identity-token'})))
      .mockResolvedValueOnce(new Response(JSON.stringify({...identity,email_verified})));
    expect((await finish()).statusCode).toBe(400); expect(mocks.save).not.toHaveBeenCalled();
  });
  it('does not trust an id_token when userinfo fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({access_token:'identity-token',id_token:'fake.eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0.fake'})))
      .mockResolvedValueOnce(new Response('{}',{status:401}));
    expect((await finish()).statusCode).toBe(400); expect(mocks.save).not.toHaveBeenCalled();
  });
  it('does not report success if the database fails to retain verification', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({access_token:'identity-token'})))
      .mockResolvedValueOnce(new Response(JSON.stringify(identity)));
    mocks.select.mockResolvedValue({data:roles.map(role=>({role,paypal_email:'verified@example.com',is_verified:false})),error:null});
    const result=await finish(); expect(result.statusCode).toBe(500); expect(JSON.parse(result.body).ok).not.toBe(true);
  });
  it('rejects missing identity and missing access tokens', async () => {
    await expect(getVerifiedPayPalIdentity('https://api-m.paypal.com','')).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({email:'a@example.com',email_verified:true})));
    await expect(getVerifiedPayPalIdentity('https://api-m.paypal.com','token')).rejects.toThrow();
  });
});
