import { randomUUID, createHash } from 'node:crypto';
import { createSupabaseAdmin } from './_lib/supabase';
import { validateDigitalFile } from './_lib/digital-file-validation';
import { DIGITAL_INLINE_MAX_BYTES } from '../../shared/digitalPolicy';
export default async (req: Request) => {
  const reply = (status:number, body:any) => Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  if (req.method !== 'POST') return reply(405,{error:'Method not allowed'});
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /,'');
  if (!token) return reply(401,{error:'Sign in to upload.'});
  const db = createSupabaseAdmin();
  const {data:auth,error:authError} = await db.auth.getUser(token);
  if (authError || !auth.user) return reply(401,{error:'Invalid session.'});
  if (!auth.user.email_confirmed_at) return reply(403,{error:'Verify your email before uploading.'});
  try {
    const raw = await req.text();
    if (raw.length > DIGITAL_INLINE_MAX_BYTES*1.4 + 2048) return reply(413,{error:'Files over 3 MB must use the direct private uploader.'});
    const body = JSON.parse(raw);
    const filename = String(body.filename || '');
    const encoded = String(body.fileData || '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return reply(400,{error:'Invalid file encoding.'});
    const bytes = Buffer.from(encoded,'base64');
    const contentType = validateDigitalFile(filename,bytes);
    const {data:profile,error:profileError} = await db.from('profiles').select('id').eq('user_id',auth.user.id).maybeSingle();
    if (profileError || !profile) return reply(403,{error:'Complete your account setup first.'});
    const path = `${auth.user.id}/${randomUUID()}/${filename.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const {error:reserveError} = await db.rpc('reserve_digital_upload',{p_user:auth.user.id,p_path:path,p_filename:filename,p_mime:contentType,p_size:bytes.length,p_sha256:createHash('sha256').update(bytes).digest('hex')});
    if (reserveError) return reply(429,{error:'Upload quota reached. Try later or contact support.'});
    const {error:uploadError} = await db.storage.from('digital-products-private').upload(path,bytes,{upsert:false,contentType});
    if (uploadError) { await db.from('digital_file_uploads').delete().eq('storage_path',path); return reply(503,{error:'Upload failed. Please retry.'}); }
    return reply(200,{bucket:'digital-products-private',path,filename,contentType,fileSize:bytes.length});
  } catch (error) { return reply(400,{error:error instanceof Error ? error.message : 'Invalid upload.'}); }
};
