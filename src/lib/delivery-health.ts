import 'server-only';
import webpush from 'web-push';
import {createAdminClient} from './supabase/admin';
export async function deliveryHealth(){
 const db=createAdminClient();const cutoff=new Date(Date.now()-15*60000).toISOString();
 const [failed,delayed]=await Promise.all([
  db.from('notification_jobs').select('id',{count:'exact',head:true}).neq('kind','delivery_alert').eq('status','failed'),
  db.from('notification_jobs').select('id',{count:'exact',head:true}).neq('kind','delivery_alert').in('status',['pending','sending']).lt('due_at',cutoff),
 ]);
 if(failed.error||delayed.error)throw new Error('Message health could not load');
 return {failed:failed.count||0,delayed:delayed.count||0};
}
export async function alertDeliveryProblems(){
 const health=await deliveryHealth();
 if(!health.failed&&!health.delayed)return {alerted:false,...health};
 if(!process.env.VAPID_PUBLIC_KEY||!process.env.VAPID_PRIVATE_KEY)return {alerted:false,reason:'Owner push is not configured',...health};
 const db=createAdminClient();const {data:owners,error}=await db.from('staff_members').select('user_id').eq('role','owner').eq('active',true);
 if(error)throw new Error('Owner alerts could not load');
 if(!owners?.length)return {alerted:false,reason:'No active owner',...health};
 const {data:subs,error:subError}=await db.from('push_subscriptions').select('id,subscription').in('staff_user',owners.map(o=>o.user_id));
 if(subError)throw new Error('Owner notification devices could not load');
 if(!subs?.length)return {alerted:false,reason:'Owner must enable notifications on a device',...health};
 // One claim per hour across workers. Alerts do not depend on the email provider.
 const key='delivery-alert-'+Math.floor(Date.now()/3600000);
 const {data:claim,error:claimError}=await db.from('notification_jobs').insert({dedupe_key:key,kind:'delivery_alert',channel:'push',status:'sending',locked_at:new Date().toISOString(),attempts:1,payload:health}).select('id').single();
 if(claimError?.code==='23505')return {alerted:false,reason:'Already attempted this hour',...health};
 if(claimError||!claim)throw new Error('Owner alert could not be claimed');
 webpush.setVapidDetails(process.env.VAPID_CONTACT||'mailto:info@symmetrywales.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 let delivered=0;
 for(const sub of subs){try{await webpush.sendNotification(sub.subscription,JSON.stringify({body:'Booking messages need attention. Open your diary to review.',url:'/staff'}),{timeout:10000});delivered++;}catch(e){if([404,410].includes((e as {statusCode?:number}).statusCode||0))await db.from('push_subscriptions').delete().eq('id',sub.id);}}
 await db.from('notification_jobs').update({status:delivered?'sent':'failed',last_error:delivered?null:'No owner device accepted the alert'}).eq('id',claim.id);
 return {alerted:delivered>0,...health};
}
