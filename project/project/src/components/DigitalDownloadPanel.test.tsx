import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('../lib/supabase',()=>({supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}}}));
import DigitalDownloadPanel from './DigitalDownloadPanel';
let view:ReactTestRenderer;
const entitlement={id:'owned',title:'Guide',filename:'guide.txt',remainingDownloads:5,fileSizeBytes:12};
const button=(name:string)=>view.root.findAllByType('button').find(x=>x.children.filter(child=>typeof child==='string').join('')===name)!;
beforeEach(async()=>{
 vi.stubGlobal('window',{confirm:()=>{throw Error('Native popup blocked')}});
 vi.stubGlobal('fetch',vi.fn(async(_url,options)=>options?.method==='POST'
  ? new Response('file content',{headers:{'content-type':'text/plain'}})
  : new Response(JSON.stringify({entitlements:[entitlement]}),{headers:{'content-type':'application/json'}})));
 vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:ready');
 vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});
 await act(async()=>{view=create(<DigitalDownloadPanel/>)});
});
afterEach(async()=>{await act(async()=>view.unmount());vi.restoreAllMocks();vi.unstubAllGlobals()});
describe('visible digital delivery',()=>{
 it('requires on-page acceptance and leaves a clickable save link for mobile browsers',async()=>{
  await act(async()=>button('Download file').props.onClick());
  expect(view.root.findByProps({role:'dialog'})).toBeTruthy();
  expect(vi.mocked(fetch).mock.calls.filter(x=>x[1]?.method==='POST')).toHaveLength(0);
  await act(async()=>{await button('Accept and prepare file').props.onClick()});
  expect(view.root.findByType('a').props).toMatchObject({href:'blob:ready',download:'guide.txt'});
  expect(vi.mocked(fetch).mock.calls.filter(x=>x[1]?.method==='POST')).toHaveLength(1);
 });
 it('allows cancelling without consuming access',async()=>{
  await act(async()=>button('Download file').props.onClick());
  await act(async()=>button('Cancel').props.onClick());
  expect(view.root.findAllByProps({role:'dialog'})).toHaveLength(0);
  expect(vi.mocked(fetch).mock.calls.filter(x=>x[1]?.method==='POST')).toHaveLength(0);
 });
 it('shows a failed request without offering an empty download',async()=>{
  vi.mocked(fetch).mockImplementationOnce(async()=>new Response(JSON.stringify({error:'Storage unavailable'}),{status:503}));
  await act(async()=>button('Download file').props.onClick());
  await act(async()=>{await button('Accept and prepare file').props.onClick()});
  expect(JSON.stringify(view.toJSON())).toContain('Storage unavailable');
  expect(view.root.findAllByType('a')).toHaveLength(0);
 });
});
