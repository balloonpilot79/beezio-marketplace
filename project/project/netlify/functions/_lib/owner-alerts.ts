import { createHash } from 'node:crypto';
import { sendTransactionalEmail } from './email';
export const ownerAlertEmail=()=>String(process.env.DISPUTE_ALERT_EMAIL||process.env.OWNER_ALERT_EMAIL||'jasonlovingsr@gmail.com').trim().toLowerCase();
const escape=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export async function queueOwnerAlert(db:any,eventKey:string,payload:Record<string,unknown>){
 const {error}=await db.from('owner_alert_outbox').upsert({event_key:eventKey,payload},{onConflict:'event_key',ignoreDuplicates:true});
 if(error)throw new Error('Could not persist owner alert: '+error.message);
}
export async function dispatchOwnerAlerts(db:any){
 const {data,error}=await db.rpc('claim_owner_alerts',{p_limit:5});
 if(error)throw new Error('Could not claim owner alerts: '+error.message);
 const results=await Promise.all((data||[]).map(async(a:any)=>{
  const p=a.payload||{};let sent=false,reason='';
  try{
   const result=await sendTransactionalEmail({to:ownerAlertEmail(),subject:'Beezio: '+String(p.title||'Action required'),html:`<div style="font-family:Arial,sans-serif"><h2>${escape(p.title||'Action required')}</h2>${Object.entries(p).filter(([k])=>k!=='title').map(([k,v])=>`<p><strong>${escape(k)}:</strong> ${escape(typeof v==='object'?JSON.stringify(v):v)}</p>`).join('')}<p><a href="https://beezio.co/support/ops">Open Beezio support operations</a></p></div>`,idempotencyKey:'beezio-owner-'+createHash('sha256').update(a.event_key).digest('hex'),timeoutMs:7000});
   sent=result.sent;reason=result.reason||'';
  }catch(e){reason=String(e);}
  const {error:ue}=await db.from('owner_alert_outbox').update({status:sent?'sent':'pending',sent_at:sent?new Date().toISOString():null,last_error:sent?null:reason.slice(0,1000),lease_until:null,lease_token:null,next_attempt_at:new Date(Date.now()+Math.min(3600,30*2**Math.min(a.attempts,7))*1000).toISOString()}).eq('id',a.id).eq('lease_token',a.lease_token);
  if(ue)throw new Error('Could not record owner alert result: '+ue.message);
  return{sent};
 }));
 return{sent:results.filter(r=>r.sent).length,failed:results.filter(r=>!r.sent).length};
}
