import { beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({duplicate:false,db:{from:vi.fn()},queue:vi.fn(async()=>{}),dispatch:vi.fn(async()=>({sent:1,failed:0}))}));
vi.mock('../../netlify/functions/_lib/supabase',()=>({createSupabaseAdmin:()=>mocks.db}));
vi.mock('../../netlify/functions/_lib/paypal',()=>({verifyPayPalWebhookSignature:vi.fn(async()=>true)}));
vi.mock('../../netlify/functions/_lib/paypal-payment-recovery',()=>({recoverCompletedPayPalPayment:vi.fn()}));
vi.mock('../../netlify/functions/_lib/dispute-alerts',()=>({notifyDisputeParties:vi.fn()}));
vi.mock('../../netlify/functions/_lib/owner-alerts',()=>({queueOwnerAlert:mocks.queue,dispatchOwnerAlerts:mocks.dispatch}));
import { handler } from '../../netlify/functions/paypal-webhook';
beforeEach(()=>{vi.clearAllMocks();mocks.duplicate=false;mocks.db.from.mockImplementation((table:string)=>{const q:any={insert:()=>q,select:()=>q,eq:()=>q,in:()=>q,or:()=>q,limit:()=>q,maybeSingle:()=>q,then:(resolve:any)=>Promise.resolve({data:null,error:table==='paypal_webhook_events'&&mocks.duplicate?{code:'23505',message:'duplicate'}:null}).then(resolve)};return q;});});
describe('owner receives every provider dispute',()=>{
 it.each(['CUSTOMER.DISPUTE.CREATED','CUSTOMER.DISPUTE.UPDATED','CUSTOMER.DISPUTE.RESOLVED','RISK.DISPUTE.CREATED','PAYMENT.CAPTURE.REVERSED'])('forwards %s even without a matching Beezio order',async eventType=>{
  const response=await handler({httpMethod:'POST',headers:{},body:JSON.stringify({id:'event-1',event_type:eventType,resource:{id:'provider-case',dispute_id:'case-1'}})} as any,{} as any,()=>{});
  expect(response?.statusCode).toBe(200);expect(mocks.queue).toHaveBeenCalledWith(mocks.db,'paypal-dispute:event-1',expect.objectContaining({event_type:eventType}));expect(mocks.dispatch).toHaveBeenCalled();
 });
 it('still retries owner delivery for a redelivered provider event',async()=>{mocks.duplicate=true;await handler({httpMethod:'POST',headers:{},body:JSON.stringify({id:'event-1',event_type:'CUSTOMER.DISPUTE.CREATED',resource:{}})} as any,{} as any,()=>{});expect(mocks.queue).toHaveBeenCalled();expect(mocks.dispatch).toHaveBeenCalled();});
});
