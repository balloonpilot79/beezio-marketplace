import { randomUUID } from 'node:crypto';
import { createSupabaseAdmin } from './_lib/supabase';
import { digitalFileContentType } from './_lib/digital-file-validation';
import { DIGITAL_MAX_BYTES } from '../../shared/digitalPolicy';
const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export default async (req:Request)=>{
 if(!['GET','POST'].includes(req.method))return reply(405,{error:'Method not allowed'});
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(!token)return reply(401,{error:'Sign in to upload.'});
 const db=createSupabaseAdmin();
 const {data:auth,error:authError}=await db.auth.getUser(token);
 if(authError||!auth.user)return reply(401,{error:'Invalid session.'});
 if(!auth.user.email_confirmed_at)return reply(403,{error:'Verify your email before uploading.'});
 try{
  if(req.method==='GET'){
   const id=new URL(req.url).searchParams.get('id')||'';
   if(!/^[0-9a-f-]{36}$/i.test(id))return reply(400,{error:'Invalid upload session.'});
   const {data:row,error}=await db.from('digital_file_uploads').select('storage_path,original_filename,content_type,file_size_bytes,validation_status,validation_error').eq('upload_id',id).eq('seller_user_id',auth.user.id).maybeSingle();
   if(error)return reply(503,{error:'Unable to check upload status.'});
   if(!row)return reply(404,{error:'Upload not found.'});
   return reply(200,{status:row.validation_status,error:row.validation_error,...(row.validation_status==='approved'?{bucket:'digital-products-private',path:row.storage_path,filename:row.original_filename,contentType:row.content_type,fileSize:Number(row.file_size_bytes)}:{})});
  }
  const raw=await req.text();if(raw.length>4096)return reply(413,{error:'Send file details only. Upload file bytes directly to private storage.'});
  const body=JSON.parse(raw),filename=String(body.filename||''),size=Number(body.fileSize);
  const mime=digitalFileContentType(filename);
  if(!Number.isSafeInteger(size)||size<1||size>DIGITAL_MAX_BYTES)return reply(413,{error:'Maximum digital file size is 50 MB.'});
  const {data:profile,error:profileError}=await db.from('profiles').select('id').eq('user_id',auth.user.id).maybeSingle();
  if(profileError||!profile)return reply(403,{error:'Complete your account setup first.'});
  // Remove only this seller's expired, unpublished quarantine files, on demand.
  const {data:expired}=await db.from('digital_file_uploads').select('upload_id,quarantine_path').eq('seller_user_id',auth.user.id).in('validation_status',['pending','validating']).lt('created_at',new Date(Date.now()-86400000).toISOString()).limit(20);
  for(const row of expired||[]){
   if(row.quarantine_path){const {error}=await db.storage.from('digital-products-quarantine').remove([row.quarantine_path]);if(error)continue;}
   await db.from('digital_file_uploads').update({validation_status:'rejected',validation_error:'Upload session expired. Please upload again.'}).eq('upload_id',row.upload_id).in('validation_status',['pending','validating']);
  }
  const safe=filename.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`${auth.user.id}/${randomUUID()}/${safe}`,quarantinePath=`${auth.user.id}/${randomUUID()}/${safe}`;
  const {data:id,error:reserveError}=await db.rpc('begin_digital_upload',{p_user:auth.user.id,p_path:path,p_quarantine:quarantinePath,p_filename:filename,p_mime:mime,p_size:size});
  if(reserveError)return reply(429,{error:'Upload quota reached or pending uploads need to finish. Contact support if you need more space.'});
  const {data:signed,error:signError}=await db.storage.from('digital-products-quarantine').createSignedUploadUrl(quarantinePath,{upsert:false});
  if(signError||!signed?.token){await db.from('digital_file_uploads').update({validation_status:'rejected',validation_error:'Upload permission could not be created.'}).eq('upload_id',id);return reply(503,{error:'Unable to prepare private upload. Please retry.'});}
  const url=new URL(String(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL));
  if(url.hostname.endsWith('.supabase.co'))url.hostname=url.hostname.replace('.supabase.co','.storage.supabase.co');
  return reply(200,{uploadId:id,bucket:'digital-products-quarantine',path:quarantinePath,token:signed.token,contentType:mime,endpoint:`${url.origin}/storage/v1/upload/resumable/sign`});
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Invalid upload request.'});}
};
