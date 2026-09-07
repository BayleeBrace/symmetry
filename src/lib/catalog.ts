import 'server-only';
import { SERVICES, OPENING_HOURS, type Service, type BarberId } from './booking-data';
import { createAdminClient, hasSupabase } from './supabase/admin';
export async function getCatalog() {
 if(!hasSupabase()) return {services:SERVICES,hours:OPENING_HOURS};
 const db=createAdminClient();
 const [prices,barbers,services,hours]=await Promise.all([db.from('service_prices').select('*').eq('active',true),db.from('barbers').select('id,slug').eq('active',true),db.from('services').select('id,slug,name').eq('active',true).order('display_order'),db.from('opening_hours').select('*')]);
 if(prices.error||barbers.error||services.error||hours.error) throw new Error('Prices and hours could not load');
 const result:Service[]=services.data.map(s=>({id:s.slug,name:s.name,barbers:Object.fromEntries(barbers.data.map(b=>{const p=prices.data.find(p=>p.service_id===s.id&&p.barber_id===b.id);return [b.slug,p?{price:p.price_pence/100,duration:p.duration}:null];}).filter(([,p])=>p)) as Record<BarberId,{price:number;duration:number}>}));
 return {services:result,hours:Object.fromEntries(hours.data.map(h=>[h.iso_weekday%7,h.open_minute===null?null:[h.open_minute,h.close_minute]])) as typeof OPENING_HOURS};
}
export type Policy={cancellation_hours:number;late_percent:number;no_show_percent:number;policy_confirmed:boolean;version:string};
export async function getPolicy():Promise<Policy> {
 if(!hasSupabase()) return {cancellation_hours:6,late_percent:50,no_show_percent:100,policy_confirmed:false,version:'2026-09-07'};
 const {data,error}=await createAdminClient().from('shop_settings').select('*').eq('id',true).single();
 if(error) throw new Error('The cancellation policy could not load'); return data;
}
