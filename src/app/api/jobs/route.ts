import { alertDeliveryProblems } from "@/lib/delivery-health";
import { processNotifications, checkWaitlist } from "@/lib/notifications";
import { queueRebookNudges } from "@/lib/rebook";
import { sendStaffBriefs } from "@/lib/staff-push";
import { privateJson, publicError } from "@/lib/security";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET
  )
    return privateJson({ error: "Unauthorized" }, 401);
  // The team's own pushes (tomorrow's brief, the no-show nudge) go out whether or not customer messaging is on.
  const staff = await sendStaffBriefs().catch((e: Error) => ({
    error: e.message,
  }));
  if (process.env.NOTIFICATIONS_ENABLED !== "true")
    return privateJson({ skipped: "Notifications are disabled", staff });
  try {
    // Customer confirmations and reminders first. Each step after it is kept
    // apart, so a waitlist or reminder problem never holds the queue up.
    const notifications = await processNotifications();
    const waitlistAlerts = await checkWaitlist().catch((e: Error) => ({
      alerted: 0,
      error: e.message,
    }));
    const reminders = await queueRebookNudges().catch((e: Error) => ({
      queued: 0,
      error: e.message,
    }));
    const alerts = await alertDeliveryProblems().catch((e: Error) => ({
      alerted: false,
      error: e.message,
    }));
    return privateJson({
      ...notifications,
      waitlistAlerts,
      reminders,
      alerts,
      staff,
    });
  } catch (e) {
    return publicError(e, 503);
  }
}
