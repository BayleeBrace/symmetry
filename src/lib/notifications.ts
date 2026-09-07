import 'server-only';
import {deadlineLabel,shopInstant} from './booking-policy';
import webpush from 'web-push';
import {createAdminClient} from './supabase/admin';
import {signLink,siteUrl} from './security';
import {clock,fullDate,makeSlots,shopToday,addDays,type BarberChoice} from './booking-data';
import {getCatalog} from './catalog';
import {busyFor} from './availability';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export async function processNotifications(){
 const db=createAdminClient();
 // Ambiguous interrupted deliveries require staff review rather than risking duplicate SMS.
 await db.from('notification_jobs').update({status:'failed',last_error:'Delivery interrupted; reconcile provider before retry'}).eq('status','sending').lt('locked_at',new Date(Date.now()-15*60000).toISOString());
 const {data:jobs,error}=await db.rpc('claim_notification_jobs');if(error)throw new Error('Notification queue could not be claimed');
 let sent=0,failed=0;
 for(const job of jobs||[]){try{
  let email=job.payload.email as string|undefined,phone:string|undefined,url=job.payload.url as string|undefined,text='',subject='Your Symmetry trim';
  if(job.group_id){const {data:g,error}=await db.from('booking_groups').select('id,policy_snapshot,customers(name,email,phone)').eq('id',job.group_id).single();if(error||!g)throw new Error('Booking not found');const customer=g.customers as unknown as {name:string;email:string;phone:string};email=customer.email;phone=customer.phone;url=siteUrl()+'/bookings?token='+signLink('manage',g.id);
   const {data:b}=await db.from('bookings').select('local_date,start_minute,status,late_minutes,services(name),barbers(name)').eq('id',job.booking_id).single();if(!b)throw new Error('Trim not found');
   if((['reminder','confirmed','moved'].includes(job.kind)&&b.status!=='booked') || (job.kind==='reminder'&&shopInstant(b.local_date,b.start_minute).getTime()<=Date.now())){await db.from('notification_jobs').update({status:'cancelled'}).eq('id',job.id);continue;}
   const service=b.services as unknown as {name:string};const barber=b.barbers as unknown as {name:string};
   subject=job.kind==='reminder'?'Your upcoming trim':job.kind==='cancelled'?'Your trim has been cancelled':job.kind==='moved'?'Your trim has moved':job.kind==='no_show'?'We missed you at Symmetry':job.kind==='running_late'?'Running-late update':'Your Symmetry booking';
   text=`${subject}. ${fullDate(b.local_date)} at ${clock(b.start_minute)}: ${service.name} with ${barber.name}. ${job.kind==='running_late'?`The shop has been notified you expect to be ${b.late_minutes} minutes late.`:'View your booking and cancellation policy using your secure link.'}`;
   if(['confirmed','moved','reminder'].includes(job.kind)&&g.policy_snapshot){text+=` Free cancellation until ${deadlineLabel(b.local_date,b.start_minute,g.policy_snapshot.cancellation_hours)}. Late cancellation: ${g.policy_snapshot.late_percent}%; no-show: ${g.policy_snapshot.no_show_percent}%. Move or cancel using your booking link.`;}
  }else if(job.kind==='recovery'){const {data}=await db.from('customers').select('id').eq('email',email).limit(1);if(!data?.length){await db.from('notification_jobs').update({status:'cancelled'}).eq('id',job.id);continue;}subject='Your secure booking link';text='Use this private link to view your booking history. It expires in one hour.';}
  else if(job.kind==='waitlist_verify'){subject='Confirm your waitlist request';text='Confirm you’d like an alert when a time opens up. This link expires in 24 hours.';}
  else {subject='A chair is available';text='A time is available on your requested day. Book online to reserve it; availability can change.';}
  let providerId:string|undefined;
  if(job.channel==='email'){
   if(!email){await db.from('notification_jobs').update({status:'cancelled'}).eq('id',job.id);continue;}
   if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw new Error('Email provider not configured');
   const html=`<div style="background:#efebe3;color:#161616;padding:36px;font:16px Arial,sans-serif"><p style="letter-spacing:5px">SYMMETRY</p><h1 style="font:normal 34px Georgia,serif">${escape(subject)}.</h1><p>${escape(text)}</p><p><a href="${escape(url!)}" style="display:inline-block;background:#4a2026;color:#fff;padding:14px 20px;text-decoration:none">${job.kind==='waitlist_verify'?'confirm request':'view details'}</a></p><p>4 Brewery Terrace, Saundersfoot</p></div>`;
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':job.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject,html,text:text+'\n'+url}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Email provider returned '+response.status);providerId=(await response.json()).id;
  }else if(job.channel==='sms'){
   if(!phone||!phone.startsWith('+')||!process.env.TWILIO_ACCOUNT_SID||!process.env.TWILIO_AUTH_TOKEN||!process.env.TWILIO_FROM){await db.from('notification_jobs').update({status:'cancelled',last_error:'SMS not configured or number unavailable'}).eq('id',job.id);continue;}
   const sid=process.env.TWILIO_ACCOUNT_SID;const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(sid+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:phone,From:process.env.TWILIO_FROM,Body:text+' '+url}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('SMS provider returned '+r.status);providerId=(await r.json()).sid;
  }else{
   if(!process.env.VAPID_PRIVATE_KEY||!process.env.VAPID_PUBLIC_KEY){await db.from('notification_jobs').update({status:'cancelled'}).eq('id',job.id);continue;}
   webpush.setVapidDetails(process.env.VAPID_CONTACT||'mailto:info@symmetrywales.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
   const {data:subs}=await db.from('push_subscriptions').select('*').eq('group_id',job.group_id);
   for(const sub of subs||[]){try{await webpush.sendNotification(sub.subscription,JSON.stringify({body:subject,url}),{timeout:10000});}catch(e){if([404,410].includes((e as {statusCode?:number}).statusCode||0))await db.from('push_subscriptions').delete().eq('id',sub.id);else throw e;}}
   // Staff notifications contain no customer details on the lock screen.
   if(['confirmed','moved','cancelled','running_late'].includes(job.kind)){const {data:b}=await db.from('bookings').select('barber_id').eq('id',job.booking_id).single();const {data:members}=await db.from('staff_members').select('user_id,role,barber_id').eq('active',true);const ids=(members||[]).filter(m=>m.role==='owner'||m.barber_id===b?.barber_id).map(m=>m.user_id);const {data:ss}=await db.from('push_subscriptions').select('*').in('staff_user',ids);for(const sub of ss||[])await webpush.sendNotification(sub.subscription,JSON.stringify({body:'Your diary has an update.',url:'/staff'}),{timeout:10000});}
  }
  const {error:save}=await db.from('notification_jobs').update({status:'sent',provider_id:providerId}).eq('id',job.id);if(save)throw new Error('Provider accepted message; recording failed');sent++;
 }catch(e){failed++;await db.from('notification_jobs').update({status:'failed',last_error:(e as Error).message.slice(0,200)}).eq('id',job.id);}}
 return {sent,failed};
}
export async function checkWaitlist(){const db=createAdminClient();const {data,error}=await db.from('waitlist_requests').select('*,barbers(slug),services(slug)').eq('active',true).eq('verified',true).gte('preferred_date',shopToday()).lte('preferred_date',addDays(shopToday(),120)).limit(25);if(error)throw new Error('Waitlist could not load');const catalog=await getCatalog();let alerted=0;for(const w of data){const barber=(w.barbers?.slug||'any') as BarberChoice;const service=w.services?.slug;if(!service)continue;const slots=makeSlots(w.preferred_date,barber,service,await busyFor(w.preferred_date,barber),catalog);if(slots.length){const {error}=await db.from('notification_jobs').upsert({dedupe_key:'waitlist-alert-'+w.id,kind:'waitlist_alert',channel:'email',payload:{email:w.email,url:siteUrl()+`/book?barber=${barber}&service=${service}&date=${w.preferred_date}`}}, {onConflict:'dedupe_key',ignoreDuplicates:true});if(!error){await db.from('waitlist_requests').update({active:false}).eq('id',w.id);alerted++;}}}return alerted;}
