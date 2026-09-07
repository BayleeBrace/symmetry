import {cookies} from 'next/headers';
import {z} from 'zod';
import {createAdminClient} from '@/lib/supabase/admin';
import {requireStaff} from '@/lib/staff';
import {sameOrigin,rateLimit,privateJson,publicError} from '@/lib/security';
export async function GET(){try{return privateJson(await requireStaff());}catch{return privateJson({error:'Please sign in'},401);}}
export async function POST(req:Request){try{sameOrigin(req);await rateLimit(req,'staff-login',8);const {email,password}=z.object({email:z.email(),password:z.string().min(1).max(200)}).parse(await req.json());const db=createAdminClient();const {data,error}=await db.auth.signInWithPassword({email,password});if(error||!data.user||!data.session)throw new Error('Check your email and password');const {data:staff}=await db.from('staff_members').select('role').eq('user_id',data.user.id).eq('active',true).maybeSingle();if(!staff)throw new Error('Staff access has not been set up');(await cookies()).set('symmetry_staff',data.session.access_token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:data.session.expires_in});return privateJson({ok:true});}catch(e){return publicError(e,401);}}
export async function DELETE(req:Request){sameOrigin(req);const jar=await cookies();const token=jar.get('symmetry_staff')?.value;if(token)await createAdminClient().auth.admin.signOut(token,'local');jar.delete('symmetry_staff');return privateJson({ok:true});}
