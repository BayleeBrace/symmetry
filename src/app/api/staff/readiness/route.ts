import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson, publicError } from "@/lib/security";
export async function GET() {
  try {
    await requireStaff(true);
    const configured = (keys: string[]) =>
      keys.every((key) => Boolean(process.env[key]));
    const db = createAdminClient();
    const [settings, jobs, staff] = await Promise.all([
      db.from("shop_settings").select("policy_confirmed").single(),
      db
        .from("notification_jobs")
        .select("id,kind,channel,status,due_at,last_error")
        .in("status", ["pending", "failed", "sending"])
        .order("due_at")
        .limit(50),
      db.from("staff_members").select("user_id").eq("active", true),
    ]);
    if (settings.error || jobs.error || staff.error)
      throw new Error(
        "Readiness checks could not load. Check the database upgrade.",
      );
    return privateJson({
      checks: [
        {
          label: "Public shop contact details",
          ready: configured(["SHOP_PHONE", "SHOP_EMAIL"]),
        },
        {
          label: "Privacy notice reviewed",
          ready:
            process.env.PRIVACY_CONFIRMED === "true" &&
            configured([
              "PRIVACY_CONTROLLER",
              "PRIVACY_RETENTION",
              "PRIVACY_TRANSFERS",
              "SHOP_EMAIL",
            ]),
        },
        {
          label: "Monitored email reply address",
          ready: configured(["EMAIL_REPLY_TO"]) || configured(["SHOP_EMAIL"]),
        },
        {
          label: "Cancellation policy confirmed",
          ready: settings.data.policy_confirmed,
        },
        {
          label: "Saved-card configuration present",
          ready: configured(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]),
        },
        {
          label: "Email configuration present",
          ready: configured(["RESEND_API_KEY", "EMAIL_FROM"]),
        },
        {
          label: "SMS configuration present (optional)",
          ready: configured([
            "TWILIO_ACCOUNT_SID",
            "TWILIO_AUTH_TOKEN",
            "TWILIO_FROM",
          ]),
        },
        {
          label: "Secure booking links",
          ready: (process.env.LINK_SIGNING_SECRET?.length || 0) >= 32,
        },
        {
          label: "Scheduled messaging enabled",
          ready:
            configured(["CRON_SECRET"]) &&
            process.env.NOTIFICATIONS_ENABLED === "true",
        },
        { label: "Staff accounts active", ready: Boolean(staff.data.length) },
        {
          label: "Google review link for thank-you emails (optional)",
          ready: configured(["GOOGLE_REVIEW_URL"]),
        },
        {
          label: "Online bookings enabled",
          ready: process.env.BOOKINGS_ENABLED === "true",
        },
      ],
      jobs: jobs.data,
      note: "Configuration checks do not prove delivery or payments work. Complete the staging trial before launch.",
    });
  } catch (error) {
    return publicError(error, 403);
  }
}
