import { createHash } from 'node:crypto';
import { createSupabaseAdmin } from './_lib/supabase';
import { validateDigitalFile } from './_lib/digital-file-validation';
import { DIGITAL_MAX_BYTES } from '../../shared/digitalPolicy';
export default async(req:Request)=>{
 if(req.method!=='POST')return;
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');if(!token)return;
 const db=createSupabaseAdmin();
 const {data:auth,error:authError}=await db.auth.getUser(token);
 if(authError||!auth.user?.email_confirmed_at)return;
 let id:string;
 try{const raw=await req.text();if(raw.length>512)return;id=String(JSON.parse(raw).uploadId||'');}catch{return;}
 if(!/^[0-9a-f-]{36}$/i.test(id))return;
 const {data:claimed,error:claimError}=await db.rpc('claim_digital_upload',{p_upload:id,p_user:auth.user.id});
 if(claimError||!claimed?.length)return;
 const row=claimed[0];
 let promoted=false,approved=false;
 try{
  const {data:file,error}=await db.storage.from('digital-products-quarantine').download(row.quarantine_path);
  if(error||!file)throw new Error('The private upload could not be read. Please retry the upload.');
  if(file.size!==Number(row.file_size_bytes)||file.size>DIGITAL_MAX_BYTES)throw new Error('Uploaded file size does not match the reserved upload.');
  const bytes=Buffer.from(await file.arrayBuffer()),mime=validateDigitalFile(row.original_filename,bytes),sha256=createHash('sha256').update(bytes).digest('hex');
  // The buyer object has a separate path. An old upload token cannot modify it.
  const {error:saveError}=await db.storage.from('digital-products-private').upload(row.storage_path,bytes,{upsert:false,contentType:mime,cacheControl:'0'});
  if(saveError){
   // A retry after a worker interruption may find its already-written immutable copy.
   const {data:existing,error:existingError}=await db.storage.from('digital-products-private').download(row.storage_path);
   if(existingError||!existing||createHash('sha256').update(Buffer.from(await existing.arrayBuffer())).digest('hex')!==sha256)throw new Error('Unable to store the validated file. Please retry the upload.');
  }
  promoted=true;
  const {data:approval,error:approveError}=await db.from('digital_file_uploads').update({validation_status:'approved',validated_at:new Date().toISOString(),validation_error:null,sha256,content_type:mime}).eq('upload_id',id).eq('seller_user_id',auth.user.id).eq('validation_status','validating').select('upload_id').maybeSingle();
  if(approveError||!approval)throw new Error('Unable to finish file validation. Please retry the upload.');
  approved=true;
  try{await db.storage.from('digital-products-quarantine').remove([row.quarantine_path]);}catch{/* Cleanup can be retried; the approved buyer copy is preserved. */}
 }catch(error){
  if(approved)return;
  await db.from('digital_file_uploads').update({validation_status:'rejected',validation_error:error instanceof Error?error.message:'File validation failed.'}).eq('upload_id',id).eq('seller_user_id',auth.user.id).eq('validation_status','validating');
  await db.storage.from('digital-products-quarantine').remove([row.quarantine_path]);
  if(promoted)await db.storage.from('digital-products-private').remove([row.storage_path]);
 }
};
export const config={background:true};
