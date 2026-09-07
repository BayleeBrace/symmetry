import {z} from 'zod';
import {validDate} from '@/lib/booking-data';
import {busyFor} from '@/lib/availability';
import {hasSupabase} from '@/lib/supabase/admin';
import {privateJson,publicError,rateLimit} from '@/lib/security';
export async function GET(req:Request){try{await rateLimit(req,'availability',300);const {date,barber}=z.object({date:z.string().refine(validDate),barber:z.enum(['sean','travis','dylan','any'])}).parse(Object.fromEntries(new URL(req.url).searchParams));return privateJson({mode:hasSupabase()?'live':'preview',busy:await busyFor(date,barber)});}catch(e){return publicError(e,503);}}
