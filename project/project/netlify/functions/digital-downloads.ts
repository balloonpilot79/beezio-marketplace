import type { Handler } from '@netlify/functions';
import { createHash } from 'node:crypto';
import { createSupabaseAdmin } from './_lib/supabase';
import { json } from './_lib/http';
import { DIGITAL_MAX_BYTES, DIGITAL_POLICY_VERSION, DIGITAL_RETURN_POLICY } from '../../shared/digitalPolicy';
const reply = (status:number,body:any) => json(status,body,{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
export const handler: Handler = async event => {
  if (!['GET','POST'].includes(event.httpMethod)) return reply(405,{error:'Method not allowed'});
  const header = event.headers.authorization || event.headers.Authorization || '';
  if (!header.startsWith('Bearer ')) return reply(401,{error:'Authentication required.'});
  try {
    const db = createSupabaseAdmin();
    const {data:auth,error:authError} = await db.auth.getUser(header.slice(7));
    if (authError || !auth.user) return reply(401,{error:'Authentication required.'});
    if (event.httpMethod === 'GET') {
      let q = db.from('digital_download_entitlements').select('id,order_id,order_item_id,product_id,original_filename,content_type,file_size_bytes,download_limit,download_count,last_downloaded_at,first_access_at,access_status,created_at,metadata').eq('buyer_user_id',auth.user.id).neq('access_status','pending').order('created_at',{ascending:false}).limit(200);
      const orderId = event.queryStringParameters?.orderId;
      if (orderId) q = q.eq('order_id',orderId);
      const {data,error} = await q;
      if (error) return reply(503,{error:'Downloads are temporarily unavailable. Please retry.'});
      return reply(200,{ok:true,entitlements:(data || []).map(row=>({id:row.id,orderId:row.order_id,orderItemId:row.order_item_id,productId:row.product_id,title:row.metadata?.product_title || row.original_filename,filename:row.original_filename,contentType:row.content_type,fileSizeBytes:row.file_size_bytes,downloadLimit:row.download_limit,downloadCount:row.download_count,remainingDownloads:row.access_status==='active' ? Math.max(0,row.download_limit-row.download_count) : 0,status:row.access_status,lastDownloadedAt:row.last_downloaded_at,firstAccessAt:row.first_access_at,instructions:row.metadata?.instructions || null,returnPolicyNotice:DIGITAL_RETURN_POLICY}))});
    }
    let body:any;
    try { body=JSON.parse(event.body || '{}'); } catch { return reply(400,{error:'Invalid request.'}); }
    if (!/^[0-9a-f-]{36}$/i.test(String(body.entitlementId || ''))) return reply(400,{error:'Invalid download.'});
    if (body.policyVersion !== DIGITAL_POLICY_VERSION) return reply(400,{error:'Accept the digital download policy before accessing this file.'});
    const {data:e,error} = await db.from('digital_download_entitlements').select('id,storage_bucket,storage_path,original_filename,content_type,file_size_bytes,metadata,access_status,download_count,download_limit').eq('id',body.entitlementId).eq('buyer_user_id',auth.user.id).maybeSingle();
    if (error) return reply(503,{error:'Downloads are temporarily unavailable.'});
    if (!e) return reply(404,{error:'Download not found.'});
    if (e.access_status!=='active' || e.download_count>=e.download_limit) return reply(410,{error:'This download is unavailable or its download limit has been reached. Contact support if you need help.'});
    if (e.storage_bucket!=='digital-products-private' || e.file_size_bytes>DIGITAL_MAX_BYTES) return reply(503,{error:'Delivery file needs support review.'});
    const {data:file,error:fileError} = await db.storage.from(e.storage_bucket).download(e.storage_path);
    if (fileError || !file) return reply(503,{error:'File could not be retrieved. No download was consumed. Please retry.'});
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length!==Number(e.file_size_bytes) || createHash('sha256').update(bytes).digest('hex')!==e.metadata?.sha256) return reply(503,{error:'File integrity check failed. No download was consumed. Contact support.'});
    // File is ready before consuming. The RPC locks payment + entitlement and records
    // access atomically. No reusable public/signed storage URL is exposed.
    const {error:consumeError} = await db.rpc('consume_digital_download',{p_entitlement:e.id,p_buyer:auth.user.id,p_user_agent:event.headers['user-agent'] || '',p_policy:body.policyVersion});
    if (consumeError) return reply(409,{error:'Download access is unavailable. Check payment, dispute status, or remaining downloads.'});
    return {statusCode:200,isBase64Encoded:true,headers:{'Content-Type':e.content_type || 'application/octet-stream','Content-Disposition':`attachment; filename="${String(e.original_filename).replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},body:bytes.toString('base64')};
  } catch(error) { console.error('[digital-downloads]',error instanceof Error ? error.message : 'Unexpected error'); return reply(503,{error:'Downloads are temporarily unavailable. Please retry.'}); }
};
export default handler;
