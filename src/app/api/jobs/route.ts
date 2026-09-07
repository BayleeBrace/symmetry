import {processNotifications,checkWaitlist} from '@/lib/notifications';
import {privateJson,publicError} from '@/lib/security';
export const maxDuration=300;
export async function GET(req:Request){if(!process.env.CRON_SECRET||req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return privateJson({error:'Unauthorized'},401);if(process.env.NOTIFICATIONS_ENABLED!=='true')return privateJson({skipped:'Notifications are disabled'});try{const waitlistAlerts=await checkWaitlist();return privateJson({...await processNotifications(),waitlistAlerts});}catch(e){return publicError(e,503);}}
