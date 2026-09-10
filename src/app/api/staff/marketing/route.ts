import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson, publicError } from "@/lib/security";

// What the automated messages are, and whether the live site can send them.
export async function GET() {
  try {
    await requireStaff(true);
    const db = createAdminClient();
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [consents, sent] = await Promise.all([
      db
        .from("email_marketing_consents")
        .select("customer_id,granted,recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(5000),
      db
        .from("notification_jobs")
        .select("kind,channel,status")
        .eq("status", "sent")
        .gte("due_at", since)
        .limit(5000),
    ]);
    if (consents.error || sent.error)
      throw new Error("Marketing figures could not load");
    const latest = new Map<string, boolean>();
    for (const c of consents.data)
      if (!latest.has(c.customer_id)) latest.set(c.customer_id, c.granted);
    const optedIn = [...latest.values()].filter(Boolean).length;
    const count = (...kinds: string[]) =>
      sent.data.filter((j) => kinds.includes(j.kind)).length;
    const on = process.env.NOTIFICATIONS_ENABLED === "true";
    const email = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    const sms = Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM,
    );
    const status = (ready: boolean) =>
      on && ready ? ("on" as const) : ("setup" as const);
    const last30 = (n: number) => `${n} sent in the last 30 days.`;
    return privateJson({
      optedIn,
      automations: [
        {
          key: "confirmation",
          label: "Booking confirmation",
          description:
            "Sent the moment a trim is booked online, with the secure link to move or cancel it.",
          status: status(email),
          detail: last30(count("confirmed")),
        },
        {
          key: "reminder",
          label: "Reminder before the trim",
          description:
            "A reminder the day before, with the cancellation window spelled out.",
          status: status(email),
          detail: last30(count("reminder")),
        },
        {
          key: "delayed",
          label: "Running behind texts",
          description:
            "When a chair taps Running behind, the next two customers get a text, or an email without SMS.",
          status: status(sms || email),
          detail: `${last30(count("delayed"))}${sms ? "" : " Texts need Twilio; emails go out meanwhile."}`,
        },
        {
          key: "thanks",
          label: "Thank you and review link",
          description:
            "Two hours after a trim is checked out, a thank-you with the Google review link, or a Book again button.",
          status: status(email),
          detail: `${last30(count("thanks"))}${process.env.GOOGLE_REVIEW_URL ? " Review link set." : " No review link set yet, so it says Book again."}`,
        },
        {
          key: "nudge",
          label: "Time for a trim? reminder",
          description:
            "A week after a client's usual gap between trims, for clients who ticked the reminder box. Once every two months at most, never when they already have a trim booked.",
          status: status(email),
          detail: `${last30(count("nudge"))} ${optedIn} client${optedIn === 1 ? "" : "s"} opted in.`,
        },
        {
          key: "waitlist",
          label: "Waitlist alerts",
          description:
            "When a time opens up on a day someone asked about, they get an email to book it.",
          status: status(email),
          detail: last30(count("waitlist_alert")),
        },
      ],
    });
  } catch (e) {
    return publicError(e, 403);
  }
}
