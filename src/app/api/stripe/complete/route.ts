import {finalizeBooking} from '@/lib/finalize-booking';
import {privateJson,publicError,rateLimit} from '@/lib/security';
export async function POST(request:Request){try{await rateLimit(request,'complete');const {session}=await request.json();if(typeof session!=='string'||!/^cs_[a-zA-Z0-9_]+$/.test(session))return privateJson({error:'Invalid card setup'},400);return privateJson(await finalizeBooking(session));}catch(e){return publicError(e,409);}}
