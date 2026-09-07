import {z} from 'zod';
import {createAdminClient,hasSupabase} from '@/lib/supabase/admin';
import {sameOrigin,rateLimit,privateJson,publicError,signLink,siteUrl} from '@/lib/security';
import {createHash} from 'node:crypto';
export async function POST(req:Request){try{sameOrigin(req);await rateLimit(req,'recover',5,3600);const {email}=z.object({email:z.email().max(254)}).parse(await req.json());if(hasSupabase()){const address=email.toLowerCase();const {error}=await createAdminClient().from('notification_jobs').upsert({dedupe_key:'recover-'+createHash('sha256').update(address).digest('hex')+'-'+Math.floor(Date.now()/3600000),kind:'recovery',channel:'email',payload:{email:address,url:siteUrl()+'/bookings?account='+signLink('account',address,3600)}},{onConflict:'dedupe_key',ignoreDuplicates:true});if(error)throw new Error('Please try again later');}return privateJson({ok:true,message:'If you have bookings, a secure link will arrive shortly.'});}catch(e){return publicError(e);}}
