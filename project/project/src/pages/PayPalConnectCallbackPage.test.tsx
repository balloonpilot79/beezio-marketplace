import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
const mocks=vi.hoisted(()=>({navigate:vi.fn(),session:vi.fn()}));
vi.mock('react-router-dom',()=>({useNavigate:()=>mocks.navigate,useSearchParams:()=>[new URLSearchParams('code=code&state=state')],Link:({children}:any)=><a>{children}</a>}));
vi.mock('../lib/supabase',()=>({supabase:{auth:{getSession:mocks.session}}}));
import Callback from './PayPalConnectCallbackPage';
let view:ReactTestRenderer;
beforeEach(()=>{
 vi.useFakeTimers();mocks.navigate.mockReset();mocks.session.mockResolvedValue({data:{session:{access_token:'session'}}});
 vi.stubGlobal('localStorage',{getItem:()=> 'nonce',removeItem:vi.fn()});
 vi.stubGlobal('fetch',vi.fn());
});
afterEach(async()=>{if(view)await act(async()=>view.unmount());vi.useRealTimers();vi.unstubAllGlobals()});
describe('PayPal callback messages',()=>{
 it('never shows success or redirects when the server returns ok with false verification',async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ok:true,emailVerified:false,paypalEmail:'a@example.com'})));
  await act(async()=>{view=create(<Callback/>)});
  expect(JSON.stringify(view.toJSON())).toContain('not verified');
  expect(JSON.stringify(view.toJSON())).not.toContain('connection is ready');
  expect(mocks.navigate).not.toHaveBeenCalled();
 });
 it('shows success and returns only after confirmed verification',async()=>{
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ok:true,emailVerified:true,paypalEmail:'a@example.com',returnTo:'/dashboard?tab=payouts'})));
  await act(async()=>{view=create(<Callback/>)});
  expect(JSON.stringify(view.toJSON())).toContain('PayPal email verified');
  await act(async()=>vi.advanceTimersByTime(1200));expect(mocks.navigate).toHaveBeenCalledWith('/dashboard?tab=payouts');
 });
 it('does not exchange the one-use code twice across rerenders',async()=>{
  let resolve!:(response:Response)=>void;
  vi.mocked(fetch).mockReturnValue(new Promise<Response>(r=>{resolve=r}));
  await act(async()=>{view=create(<Callback/>)});
  await act(async()=>view.update(<Callback/>));
  await act(async()=>resolve(new Response(JSON.stringify({ok:true,emailVerified:true,paypalEmail:'a@example.com'}))));
  expect(fetch).toHaveBeenCalledTimes(1);
 });
});
