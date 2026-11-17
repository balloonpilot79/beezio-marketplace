import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
const bytes=Buffer.from('test download');
const state=vi.hoisted(()=>({user:{id:'buyer'},entitlement:null as any,rpcError:null as any,fileError:null as any}));
const rpc=vi.fn();
const download=vi.fn();
const info=vi.fn();
const createSignedUrl=vi.fn();
vi.mock('../netlify/functions/_lib/supabase',()=>({createSupabaseAdmin:()=>({auth:{getUser:async()=>({data:{user:state.user}})},from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:state.entitlement})})})})}),rpc:async(...args:any[])=>{rpc(...args);return {error:state.rpcError}},storage:{from:()=>({info,createSignedUrl,download:async(...args:any[])=>{download(...args);return {data:new Blob([bytes]),error:state.fileError}}})}})}));
import {handler} from '../netlify/functions/digital-downloads';
const request=(body:any={},headers:any={authorization:'Bearer verified'})=>handler({httpMethod:'POST',headers,body:JSON.stringify({entitlementId:'11111111-1111-4111-8111-111111111111',policyVersion:'2026-11-17',...body})} as any,{} as any);
beforeEach(()=>{vi.clearAllMocks();info.mockResolvedValue({data:{size:8*1024*1024},error:null});createSignedUrl.mockResolvedValue({data:{signedUrl:'https://private.example.test/short-lived'},error:null});state.user={id:'buyer'};state.rpcError=null;state.fileError=null;state.entitlement={id:'entitlement',storage_bucket:'digital-products-private',storage_path:'seller/file.txt',original_filename:'file.txt',content_type:'text/plain',file_size_bytes:bytes.length,metadata:{sha256:createHash('sha256').update(bytes).digest('hex')},access_status:'active',download_count:0,download_limit:5}});
describe('authenticated download delivery',()=>{
 it('blocks unauthenticated access',async()=>expect((await request({},{}))?.statusCode).toBe(401));
 it('requires explicit policy acceptance',async()=>{expect((await request({policyVersion:null}))?.statusCode).toBe(400);expect(rpc).not.toHaveBeenCalled()});
 it('does not deliver missing or another buyer entitlement',async()=>{state.entitlement=null;expect((await request())?.statusCode).toBe(404);expect(download).not.toHaveBeenCalled()});
 it('does not consume a download if storage fails',async()=>{state.fileError={message:'missing'};expect((await request())?.statusCode).toBe(503);expect(rpc).not.toHaveBeenCalled()});
 it('does not deliver tampered bytes',async()=>{state.entitlement.metadata.sha256='wrong';expect((await request())?.statusCode).toBe(503);expect(rpc).not.toHaveBeenCalled()});
 it('rejects exhausted and revoked access',async()=>{for(const status of ['exhausted','revoked','pending']){state.entitlement.access_status=status;expect((await request())?.statusCode).toBe(410)}expect(download).not.toHaveBeenCalled()});
 it('does not deliver after atomic payment/dispute/limit validation fails',async()=>{state.rpcError={message:'denied'};expect((await request())?.statusCode).toBe(409)});
 it('delivers exact bytes with no reusable storage URL and no caching',async()=>{const result:any=await request();expect(result.statusCode).toBe(200);expect(Buffer.from(result.body,'base64')).toEqual(bytes);expect(result.headers['Cache-Control']).toContain('no-store');expect(result.headers['Content-Disposition']).toContain('file.txt');expect(rpc).toHaveBeenCalledWith('consume_digital_download',expect.objectContaining({p_buyer:'buyer',p_policy:'2026-11-17'}));});
 it('delivers a large file directly from private storage without buffering through Netlify',async()=>{
  state.entitlement.file_size_bytes=8*1024*1024;
  const r:any=await request();expect(r.statusCode).toBe(200);expect(JSON.parse(r.body)).toMatchObject({url:'https://private.example.test/short-lived',expiresIn:30});
  expect(download).not.toHaveBeenCalled();expect(createSignedUrl).toHaveBeenCalledWith('seller/file.txt',30,{download:'file.txt'});expect(rpc).toHaveBeenCalledTimes(1);
 });
 it('does not consume a large-file download when storage metadata or signing fails',async()=>{
  state.entitlement.file_size_bytes=8*1024*1024;
  info.mockResolvedValueOnce({data:{size:1},error:null});expect((await request())?.statusCode).toBe(503);
  createSignedUrl.mockResolvedValueOnce({error:{message:'unavailable'}});expect((await request())?.statusCode).toBe(503);expect(rpc).not.toHaveBeenCalled();
 });
 it('never returns a large-file link if payment or dispute validation fails',async()=>{
  state.entitlement.file_size_bytes=8*1024*1024;state.rpcError={message:'disputed'};
  const r:any=await request();expect(r.statusCode).toBe(409);expect(r.body).not.toContain('https://private');
 });

});
