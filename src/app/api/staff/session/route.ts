import {cookies} from 'next/headers';
import type {Session} from '@supabase/supabase-js';
import {z} from 'zod';
import {createAdminClient} from '@/lib/supabase/admin';
import {requireStaff} from '@/lib/staff';
import {sameOrigin,rateLimit,privateJson,publicError} from '@/lib/security';
const options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict' as const,path:'/'};
async function save(session:Session){const jar=await cookies();jar.set('symmetry_staff',session.access_token,{...options,maxAge:session.expires_in});jar.set('symmetry_staff_refresh',session.refresh_token,{...options,maxAge:60*60*24*28});}
async function clear(){const jar=await cookies();jar.delete('symmetry_staff');jar.delete('symmetry_staff_refresh');}
async function membership(id:string){const {data,error}=await createAdminClient().from('staff_members').select('role').eq('user_id',id).eq('active',true).maybeSingle();if(error)throw new Error('Staff access could not be checked');return data;}
export async function GET(){try{return privateJson(await requireStaff());}catch{return privateJson({error:'Please sign in'},401);}}
export async function POST(req:Request){try{sameOrigin(req);await rateLimit(req,'staff-login',8);const {email,password}=z.object({email:z.email(),password:z.string().min(1).max(200)}).parse(await req.json());const db=createAdminClient();const {data,error}=await db.auth.signInWithPassword({email,password});if(error||!data.user||!data.session)throw new Error('Check your email and password');if(!await membership(data.user.id)){await db.auth.admin.signOut(data.session.access_token,'local');throw new Error('Staff access has not been set up');}await save(data.session);return privateJson({ok:true});}catch(e){return publicError(e,401);}}
export async function PATCH(req:Request){
 try{
  sameOrigin(req);
  const jar=await cookies(),access=jar.get('symmetry_staff')?.value,refresh=jar.get('symmetry_staff_refresh')?.value;
  if(!access&&!refresh)return privateJson({error:'Please sign in'},401);
  const auth=createAdminClient().auth;
  if(access){
   const {data,error}=await auth.getUser(access);
   if(!error&&data.user){
    if(!await membership(data.user.id)){await clear();return privateJson({error:'Staff access has been removed'},401);}
    // Expiry is only a scheduling hint. getUser and membership above authorize the request.
    let expires=0;try{expires=JSON.parse(Buffer.from(access.split('.')[1],'base64url').toString()).exp||0;}catch{}
    if(expires>Date.now()/1000+300)return privateJson({ok:true});
   }else if(error&&error.status&&error.status>=500)return privateJson({error:'Sign-in service unavailable. Try again.'},503);
  }
  if(!refresh)return privateJson({error:'Please sign in again'},401);
  const {data,error}=await auth.refreshSession({refresh_token:refresh});
  if(error||!data.session||!data.user){
   // Do not clear cookies on a failed concurrent rotation or temporary provider outage.
   return privateJson({error:'Your session could not renew. Try again or sign in.'},error?.status&&error.status>=500?503:401);
  }
  if(!await membership(data.user.id)){await auth.admin.signOut(data.session.access_token,'local');await clear();return privateJson({error:'Staff access has been removed'},401);}
  await save(data.session);return privateJson({ok:true});
 }catch(e){return publicError(e,503);}
}
export async function DELETE(req:Request){try{sameOrigin(req);}catch(e){return publicError(e,403);}const jar=await cookies();let token=jar.get('symmetry_staff')?.value;try{const auth=createAdminClient().auth;if(!token){const refresh=jar.get('symmetry_staff_refresh')?.value;if(refresh){const {data}=await auth.refreshSession({refresh_token:refresh});token=data.session?.access_token;}}if(token){const {error}=await auth.admin.signOut(token,'local');if(error)throw error;}await clear();return privateJson({ok:true});}catch{await clear();return privateJson({error:'Signed out on this device. Server session revocation could not be confirmed.'},503);}}
