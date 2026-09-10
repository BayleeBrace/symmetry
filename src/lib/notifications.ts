import "server-only";
import { deadlineLabel, shopInstant } from "./booking-policy";
import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";
import { signLink, siteUrl } from "./security";
import {
  clock,
  fullDate,
  makeSlots,
  shopToday,
  addDays,
  type BarberChoice,
} from "./booking-data";
import { getCatalog } from "./catalog";
import { busyFor } from "./availability";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function processNotifications() {
  const db = createAdminClient();
  // Ambiguous interrupted deliveries require staff review rather than risking duplicate SMS.
  await db
    .from("notification_jobs")
    .update({
      status: "failed",
      last_error: "Delivery interrupted; reconcile provider before retry",
    })
    .eq("status", "sending")
    .lt("locked_at", new Date(Date.now() - 15 * 60000).toISOString());
  const { data: jobs, error } = await db.rpc("claim_notification_jobs");
  if (error) throw new Error("Notification queue could not be claimed");
  let sent = 0,
    failed = 0;
  for (const job of jobs || []) {
    try {
      let email = job.payload.email as string | undefined,
        phone: string | undefined,
        url = job.payload.url as string | undefined,
        text = "",
        subject = "Your Symmetry trim";
      if (job.group_id) {
        const { data: g, error } = await db
          .from("booking_groups")
          .select("id,policy_snapshot,customers(name,email,phone)")
          .eq("id", job.group_id)
          .single();
        if (error || !g) throw new Error("Booking not found");
        const customer = g.customers as unknown as {
          name: string;
          email: string;
          phone: string;
        };
        email = customer.email;
        phone = customer.phone;
        url = siteUrl() + "/bookings?token=" + signLink("manage", g.id);
        const { data: b } = await db
          .from("bookings")
          .select(
            "local_date,start_minute,status,late_minutes,services(name,slug),barbers(name,slug)",
          )
          .eq("id", job.booking_id)
          .single();
        if (!b) throw new Error("Trim not found");
        if (
          (["reminder", "confirmed", "moved", "delayed"].includes(job.kind) &&
            b.status !== "booked") ||
          (job.kind === "reminder" &&
            shopInstant(b.local_date, b.start_minute).getTime() <=
              Date.now()) ||
          (job.kind === "thanks" && b.status !== "done")
        ) {
          await db
            .from("notification_jobs")
            .update({ status: "cancelled" })
            .eq("id", job.id);
          continue;
        }
        const service = b.services as unknown as { name: string; slug: string };
        const barber = b.barbers as unknown as { name: string; slug: string };
        subject =
          job.kind === "thanks"
            ? "Thanks for coming in"
            : job.kind === "reminder"
              ? "Your upcoming trim"
              : job.kind === "cancelled"
                ? "Your trim has been cancelled"
                : job.kind === "moved"
                  ? "Your trim has moved"
                  : job.kind === "no_show"
                    ? "We missed you at Symmetry"
                    : job.kind === "running_late"
                      ? "Running-late update"
                      : job.kind === "delayed"
                        ? "Running a little behind"
                        : "Your Symmetry booking";
        if (job.kind === "thanks") {
          const review = process.env.GOOGLE_REVIEW_URL;
          const first = customer.name.split(" ")[0];
          url =
            review ||
            `${siteUrl()}/book?barber=${barber.slug}&service=${service.slug}`;
          text = `Thanks for coming in, ${first}. ${service.name} with ${barber.name} on ${fullDate(b.local_date)}. ${review ? "If you have a minute, a Google review helps a small shop more than you would think." : "Book your next one whenever suits."} See you in a few weeks.`;
        } else if (job.kind === "delayed") {
          text = `${barber.name} is running about ${job.payload.minutes} minutes behind for your ${clock(b.start_minute)} trim today. Sorry for the wait; there is nothing you need to do.`;
        } else {
          text = `${subject}. ${fullDate(b.local_date)} at ${clock(b.start_minute)}: ${service.name} with ${barber.name}. ${job.kind === "running_late" ? `The shop has been notified you expect to be ${b.late_minutes} minutes late.` : "View your booking and cancellation policy using your secure link."}`;
        }
        if (
          ["confirmed", "moved", "reminder"].includes(job.kind) &&
          g.policy_snapshot
        ) {
          text += ` Free cancellation until ${deadlineLabel(b.local_date, b.start_minute, g.policy_snapshot.cancellation_hours)}. Late cancellation: ${g.policy_snapshot.late_percent}%; no-show: ${g.policy_snapshot.no_show_percent}%. Move or cancel using your booking link.`;
        }
      } else if (job.kind === "nudge") {
        const p = job.payload as {
          name: string;
          barber: string;
          service: string;
          weeks: number;
        };
        subject = "Time for a trim?";
        text = `Hi ${p.name.split(" ")[0]}. It has been about ${p.weeks} week${p.weeks === 1 ? "" : "s"} since your ${p.service.toLowerCase()} with ${p.barber}. Book your usual in a minute, or pick whatever time suits.`;
      } else if (job.kind === "recovery") {
        const { data } = await db
          .from("customers")
          .select("id")
          .eq("email", email)
          .limit(1);
        if (!data?.length) {
          await db
            .from("notification_jobs")
            .update({ status: "cancelled" })
            .eq("id", job.id);
          continue;
        }
        subject = "Your secure booking link";
        text =
          "Use this private link to view your booking history. It expires in one hour.";
      } else if (job.kind === "waitlist_verify") {
        subject = "Confirm your waitlist request";
        text =
          "Confirm you’d like an alert when a time opens up. This link expires in 24 hours.";
      } else {
        subject = "A chair is available";
        text =
          "A time is available on your requested day. Book online to reserve it; availability can change.";
      }
      let providerId: string | undefined;
      if (job.channel === "email") {
        if (!email) {
          await db
            .from("notification_jobs")
            .update({ status: "cancelled" })
            .eq("id", job.id);
          continue;
        }
        if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
          throw new Error("Email provider not configured");
        const html = `<div style="background:#efebe3;color:#161616;padding:36px;font:16px Arial,sans-serif"><img src="${escape(siteUrl())}/wordmark-email.png" width="320" height="112" alt="Symmetry" style="display:block;width:320px;max-width:100%;height:auto" /><h1 style="font:normal 28px Arial,sans-serif">${escape(subject)}.</h1><p>${escape(text)}</p><p><a href="${escape(url!)}" style="display:inline-block;background:#161616;color:#fff;padding:14px 20px;text-decoration:none">${job.kind === "waitlist_verify" ? "Confirm request" : job.kind === "thanks" ? (process.env.GOOGLE_REVIEW_URL ? "Leave a review" : "Book again") : job.kind === "nudge" ? "Book my usual" : "View details"}</a></p><p>4 Brewery Terrace, Saundersfoot</p>${job.kind === "nudge" ? `<p style="font-size:13px;color:#5a5650">You asked us to remind you when you are due. <a href="${escape(job.payload.stop)}" style="color:#5a5650">Stop these reminders</a>.</p>` : ""}</div>`;
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + process.env.RESEND_API_KEY,
            "Content-Type": "application/json",
            "Idempotency-Key": job.id,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            reply_to:
              process.env.EMAIL_REPLY_TO || process.env.SHOP_EMAIL || undefined,
            to: [email],
            subject,
            html,
            text:
              text +
              "\n" +
              url +
              (job.kind === "nudge"
                ? "\n\nStop these reminders: " + job.payload.stop
                : ""),
            headers:
              job.kind === "nudge"
                ? { "List-Unsubscribe": "<" + job.payload.stop + ">" }
                : undefined,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new Error("Email provider returned " + response.status);
        providerId = (await response.json()).id;
      } else if (job.channel === "sms") {
        if (
          !phone ||
          !phone.startsWith("+") ||
          !process.env.TWILIO_ACCOUNT_SID ||
          !process.env.TWILIO_AUTH_TOKEN ||
          !process.env.TWILIO_FROM
        ) {
          await db
            .from("notification_jobs")
            .update({
              status: "cancelled",
              last_error: "SMS not configured or number unavailable",
            })
            .eq("id", job.id);
          continue;
        }
        const sid = process.env.TWILIO_ACCOUNT_SID;
        const r = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization:
                "Basic " +
                Buffer.from(sid + ":" + process.env.TWILIO_AUTH_TOKEN).toString(
                  "base64",
                ),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: phone,
              From: process.env.TWILIO_FROM,
              Body: text + " " + url,
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!r.ok) throw new Error("SMS provider returned " + r.status);
        providerId = (await r.json()).sid;
      } else {
        if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
          await db
            .from("notification_jobs")
            .update({ status: "cancelled" })
            .eq("id", job.id);
          continue;
        }
        webpush.setVapidDetails(
          process.env.VAPID_CONTACT || "mailto:info@symmetrywales.com",
          process.env.VAPID_PUBLIC_KEY,
          process.env.VAPID_PRIVATE_KEY,
        );
        const { data: subs } = await db
          .from("push_subscriptions")
          .select("*")
          .eq("group_id", job.group_id);
        for (const sub of subs || []) {
          try {
            await webpush.sendNotification(
              sub.subscription,
              JSON.stringify({ body: subject, url }),
              { timeout: 10000 },
            );
          } catch (e) {
            if (
              [404, 410].includes(
                (e as { statusCode?: number }).statusCode || 0,
              )
            )
              await db.from("push_subscriptions").delete().eq("id", sub.id);
            else throw e;
          }
        }
        // Staff notifications contain no customer details on the lock screen.
        if (
          ["confirmed", "moved", "cancelled", "running_late"].includes(job.kind)
        ) {
          const { data: b } = await db
            .from("bookings")
            .select("barber_id")
            .eq("id", job.booking_id)
            .single();
          const { data: members } = await db
            .from("staff_members")
            .select("user_id,role,barber_id")
            .eq("active", true);
          const ids = (members || [])
            .filter((m) => m.role === "owner" || m.barber_id === b?.barber_id)
            .map((m) => m.user_id);
          const { data: ss } = await db
            .from("push_subscriptions")
            .select("*")
            .in("staff_user", ids);
          for (const sub of ss || [])
            await webpush.sendNotification(
              sub.subscription,
              JSON.stringify({
                body:
                  job.kind === "running_late"
                    ? "A customer is running late."
                    : "Your diary has an update.",
                url: "/staff",
              }),
              { timeout: 10000 },
            );
        }
      }
      const { error: save } = await db
        .from("notification_jobs")
        .update({ status: "sent", provider_id: providerId })
        .eq("id", job.id);
      if (save) throw new Error("Provider accepted message; recording failed");
      sent++;
    } catch (e) {
      failed++;
      await db
        .from("notification_jobs")
        .update({
          status: "failed",
          last_error: (e as Error).message.slice(0, 200),
        })
        .eq("id", job.id);
    }
  }
  return { sent, failed };
}
export async function checkWaitlist() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("waitlist_requests")
    .select("*,barbers(slug),services(slug)")
    .eq("active", true)
    .eq("verified", true)
    .gte("preferred_date", shopToday())
    .lte("preferred_date", addDays(shopToday(), 120))
    .limit(25);
  if (error) throw new Error("Waitlist could not load");
  const catalog = await getCatalog();
  let alerted = 0;
  for (const w of data) {
    const barber = (w.barbers?.slug || "any") as BarberChoice;
    const service = w.services?.slug;
    if (!service) continue;
    const slots = makeSlots(
      w.preferred_date,
      barber,
      service,
      await busyFor(w.preferred_date, barber),
      catalog,
    );
    if (slots.length) {
      const { error } = await db.from("notification_jobs").upsert(
        {
          dedupe_key: "waitlist-alert-" + w.id,
          kind: "waitlist_alert",
          channel: "email",
          payload: {
            email: w.email,
            url:
              siteUrl() +
              `/book?barber=${barber}&service=${service}&date=${w.preferred_date}`,
          },
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      );
      if (!error) {
        await db
          .from("waitlist_requests")
          .update({ active: false })
          .eq("id", w.id);
        alerted++;
      }
    }
  }
  return alerted;
}
