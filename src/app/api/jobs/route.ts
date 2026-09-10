import { alertDeliveryProblems } from "@/lib/delivery-health";
import { processNotifications, checkWaitlist } from "@/lib/notifications";
import { queueRebookNudges } from "@/lib/rebook";
import { privateJson, publicError } from "@/lib/security";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET
  )
    return privateJson({ error: "Unauthorized" }, 401);
  if (process.env.NOTIFICATIONS_ENABLED !== "true")
    return privateJson({ skipped: "Notifications are disabled" });
  try {
    const waitlistAlerts = await checkWaitlist();
    const reminders = await queueRebookNudges().catch((e: Error) => ({
      queued: 0,
      error: e.message,
    }));
    const notifications = await processNotifications();
    const alerts = await alertDeliveryProblems();
    return privateJson({ ...notifications, waitlistAlerts, reminders, alerts });
  } catch (e) {
    return publicError(e, 503);
  }
}
