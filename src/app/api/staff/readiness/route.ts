import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { processNotifications } from "@/lib/notifications";
import { sameOrigin, privateJson, publicError } from "@/lib/security";

/** Messages this far past due are stale: the trim has been and gone. */
const STALE_MS = 24 * 3600000;

export async function GET() {
  try {
    await requireStaff(true);
    const configured = (keys: string[]) =>
      keys.every((key) => Boolean(process.env[key]));
    const db = createAdminClient();
    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    const count = () =>
      db
        .from("notification_jobs")
        .select("id", { count: "exact", head: true })
        .neq("kind", "delivery_alert");
    const [settings, jobs, staff, stale, pending, failed, failedRows] =
      await Promise.all([
        db.from("shop_settings").select("policy_confirmed").single(),
        db
          .from("notification_jobs")
          .select("id,kind,channel,status,due_at,last_error")
          .in("status", ["pending", "failed", "sending"])
          .order("due_at")
          .limit(50),
        db.from("staff_members").select("user_id").eq("active", true),
        count().in("status", ["pending", "failed"]).lt("due_at", cutoff),
        count().eq("status", "pending").gte("due_at", cutoff),
        count().eq("status", "failed"),
        db
          .from("notification_jobs")
          .select("last_error")
          .eq("status", "failed")
          .neq("kind", "delivery_alert")
          .limit(500),
      ]);
    if (settings.error || jobs.error || staff.error)
      throw new Error(
        "Readiness checks could not load. Check the database upgrade.",
      );
    // Why messages failed, most common first, so the fix is obvious.
    const reasons = new Map<string, number>();
    for (const r of failedRows.data || []) {
      const key = (r.last_error || "No reason recorded").slice(0, 90);
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }
    const failures = [...reasons]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => ({ error, count }));
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
      counts: {
        stale: stale.count ?? 0,
        pending: pending.count ?? 0,
        failed: failed.count ?? 0,
      },
      failures,
      sending: process.env.NOTIFICATIONS_ENABLED === "true",
      note: "Configuration checks do not prove delivery or payments work. Complete the staging trial before launch.",
    });
  } catch (error) {
    return publicError(error, 403);
  }
}

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("clear_stale") }),
  z.object({ action: z.literal("retry_failed") }),
  z.object({ action: z.literal("send_now") }),
]);

/** Owner tools for the queue: drop messages whose moment has passed, or run the sender once by hand. */
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await requireStaff(true);
    const p = actions.parse(await req.json());
    const db = createAdminClient();
    if (p.action === "clear_stale") {
      const cutoff = new Date(Date.now() - STALE_MS).toISOString();
      const { data, error } = await db
        .from("notification_jobs")
        .update({
          status: "cancelled",
          last_error: "Cleared by the owner: more than a day overdue",
        })
        .in("status", ["pending", "failed"])
        .neq("kind", "delivery_alert")
        .lt("due_at", cutoff)
        .select("id");
      if (error) throw new Error("The old messages could not be cleared");
      return privateJson({ ok: true, cleared: data.length });
    }
    if (p.action === "retry_failed") {
      // Back to the queue; the sender drops any whose trim has since passed or changed.
      const { data, error } = await db
        .from("notification_jobs")
        .update({ status: "pending", last_error: null, locked_at: null })
        .eq("status", "failed")
        .neq("kind", "delivery_alert")
        .select("id");
      if (error) throw new Error("The failed messages could not be queued");
      return privateJson({ ok: true, retried: data.length });
    }
    if (process.env.NOTIFICATIONS_ENABLED !== "true")
      throw new Error(
        "Sending is switched off. Set NOTIFICATIONS_ENABLED to true in Vercel and redeploy first.",
      );
    const result = await processNotifications();
    return privateJson({ ok: true, ...result });
  } catch (error) {
    return publicError(error, 409);
  }
}
