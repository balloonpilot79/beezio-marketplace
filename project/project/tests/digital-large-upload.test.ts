import {beforeEach,describe,it,expect,vi} from 'vitest';
const s=vi.hoisted(()=>({user:{id:'seller',email_confirmed_at:'today'} as any,claim:[] as any[],file:null as Blob|null,uploadError:null as any,approvalError:null as any,updates:[] as any[],removes:[] as any[],uploads:[] as any[]}));
vi.mock('../netlify/functions/_lib/supabase',()=>({createSupabaseAdmin:()=>({
 auth:{getUser:async()=>({data:{user:s.user},error:null})},
 rpc:vi.fn(async()=>({data:s.claim,error:null})),
 from:()=>({update:(body:any)=>{s.updates.push(body);const q:any={eq:()=>q,select:()=>q,maybeSingle:async()=>({data:s.approvalError?null:{upload_id:'upload'},error:s.approvalError}),then:(resolve:any)=>Promise.resolve({error:null}).then(resolve)};return q;}}),
 storage:{from:(bucket:string)=>({
  download:async()=>({data:s.file,error:null}),
  upload:async(path:string,bytes:Buffer,options:any)=>{s.uploads.push({bucket,path,bytes,options});return {error:s.uploadError}},
  remove:async(paths:string[])=>{s.removes.push({bucket,paths});return {error:null}},
 })},
})}));
import handler from '../netlify/functions/digital-upload-validate-background.mts';
const req=()=>new Request('https://example.test/validate',{method:'POST',headers:{authorization:'Bearer session'},body:JSON.stringify({uploadId:'11111111-1111-4111-8111-111111111111'})});
beforeEach(()=>{s.user={id:'seller',email_confirmed_at:'today'};s.claim=[{upload_id:'upload',seller_user_id:'seller',original_filename:'large.txt',file_size_bytes:8*1024*1024,quarantine_path:'seller/quarantine/large.txt',storage_path:'seller/final/large.txt'}];s.file=new Blob([Buffer.alloc(8*1024*1024,65)]);s.uploadError=null;s.approvalError=null;s.updates=[];s.removes=[];s.uploads=[]});
describe('large private upload validation',()=>{
 it('validates an 8 MB file and promotes an immutable separate buyer copy',async()=>{await handler(req());expect(s.uploads).toHaveLength(1);expect(s.uploads[0]).toMatchObject({bucket:'digital-products-private',path:'seller/final/large.txt',options:{upsert:false,contentType:'text/plain'}});expect(s.updates).toContainEqual(expect.objectContaining({validation_status:'approved',sha256:expect.stringMatching(/^[a-f0-9]{64}$/)}));expect(s.removes).toContainEqual({bucket:'digital-products-quarantine',paths:['seller/quarantine/large.txt']});});
 it('blocks a forged declared size without promoting it',async()=>{s.claim[0].file_size_bytes=1;await handler(req());expect(s.uploads).toHaveLength(0);expect(s.updates).toContainEqual(expect.objectContaining({validation_status:'rejected'}));});
 it('blocks invalid contents even when its file extension was allowed',async()=>{s.claim[0].original_filename='bad.pdf';await handler(req());expect(s.uploads).toHaveLength(0);expect(s.updates).toContainEqual(expect.objectContaining({validation_status:'rejected'}));});
 it('does not approve a file when recording validation fails',async()=>{s.approvalError={message:'database unavailable'};await handler(req());expect(s.updates.at(-1)).toMatchObject({validation_status:'rejected'});expect(s.removes).toContainEqual({bucket:'digital-products-private',paths:['seller/final/large.txt']});});
 it('does not validate another seller session or replay a claimed session',async()=>{s.claim=[];await handler(req());expect(s.uploads).toHaveLength(0);expect(s.updates).toHaveLength(0)});
 it('requires a verified account before attempting validation',async()=>{s.user.email_confirmed_at=null;await handler(req());expect(s.uploads).toHaveLength(0);expect(s.updates).toHaveLength(0)});
});
