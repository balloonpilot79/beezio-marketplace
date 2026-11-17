import {beforeEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({options:null as any,file:null as any,fail:false}));
vi.mock('../lib/supabase',()=>({supabaseAnonKey:'publishable-test-key'}));
vi.mock('tus-js-client',()=>({Upload:class{constructor(file:any,options:any){state.file=file;state.options=options;}start(){state.options.onProgress(8*1024*1024,8*1024*1024);if(state.fail)state.options.onError(new Error('network'));else state.options.onSuccess();}}}));
import {uploadPrivateDigitalFile} from './digitalUpload';
const response=(value:any,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
beforeEach(()=>{vi.restoreAllMocks();state.options=null;state.file=null;state.fail=false;});
describe('browser direct private uploader',()=>{
 it('sends file bytes only to resumable storage and waits for server approval',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(response({uploadId:'session',bucket:'digital-products-quarantine',path:'seller/q/file.txt',token:'signed-scope',contentType:'text/plain',endpoint:'https://storage.test/storage/v1/upload/resumable/sign'})).mockResolvedValueOnce(response({},202)).mockResolvedValueOnce(response({status:'approved',path:'seller/final/file.txt',fileSize:8*1024*1024}));
  const file={name:'file.txt',size:8*1024*1024} as File,progress=vi.fn();
  const result=await uploadPrivateDigitalFile(file,'buyer-token',progress);
  expect(result.status).toBe('approved');expect(state.file).toBe(file);expect(state.options.chunkSize).toBe(6*1024*1024);
  expect(state.options.headers).toMatchObject({'x-signature':'signed-scope',apikey:'publishable-test-key','x-upsert':'false'});
  expect(state.options.retryDelays.length).toBeGreaterThan(1);
  expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({filename:'file.txt',fileSize:8*1024*1024});
  expect(fetch.mock.calls.every(call=>!String(call[1]?.body||'').includes('fileData'))).toBe(true);
  expect(progress).toHaveBeenCalledWith('Uploading 100%');
 });
 it('rejects files above 50 MB before requesting upload permission',async()=>{const fetch=vi.spyOn(globalThis,'fetch');await expect(uploadPrivateDigitalFile({name:'x.txt',size:50*1024*1024+1} as File,'token',vi.fn())).rejects.toThrow(/50 MB/);expect(fetch).not.toHaveBeenCalled();});
 it('never marks an interrupted upload as validated',async()=>{state.fail=true;const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(response({token:'scoped'}));await expect(uploadPrivateDigitalFile({name:'x.txt',size:8} as File,'token',vi.fn())).rejects.toThrow(/interrupted/);expect(fetch).toHaveBeenCalledTimes(1)});
 it('reports server validation failure rather than returning the quarantined file',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(response({uploadId:'session',token:'scoped'})).mockResolvedValueOnce(response({},202)).mockResolvedValueOnce(response({status:'rejected',error:'Unsafe archive'}));await expect(uploadPrivateDigitalFile({name:'x.zip',size:8} as File,'token',vi.fn())).rejects.toThrow(/Unsafe archive/);});
});
