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
        phone = job.payload.phone as string | undefined,
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
        // The team's pushes are sent straight from the booking routes (see staff-push.ts), not from here.
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
/** Five minutes: how long one person has first refusal on a freed slot. */
const OFFER_MS = 5 * 60000;

/**
 * Offer freed slots to the people waiting, one at a time per day. The first
 * person waiting gets the offer; if the slot is still free five minutes
 * later it goes to the next. Nobody is offered the same day more than twice.
 * A request covers one day or a run of days. Text where we have a mobile
 * and Twilio, else email; with neither, they stay on the list for the team
 * to ring.
 */
export async function checkWaitlist() {
  const db = createAdminClient();
  const today = shopToday();
  const { data, error } = await db
    .from("waitlist_requests")
    .select("*,barbers(slug),services(slug)")
    .eq("active", true)
    .eq("verified", true)
    .lte("preferred_date", addDays(today, 120))
    .or(
      `until_date.gte.${today},and(until_date.is.null,preferred_date.gte.${today})`,
    )
    .order("created_at")
    .limit(100);
  if (error) throw new Error("Waitlist could not load");
  const catalog = await getCatalog();
  const smsReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_FROM,
  );
  const now = Date.now();
  // One live offer per day at a time: a day with an offer made in the last five minutes is skipped.
  const offeredDays = new Set(
    (data || [])
      .filter(
        (w) =>
          w.offered_at && now - new Date(w.offered_at).getTime() < OFFER_MS,
      )
      .map((w) => (w.offered_slot as string | null)?.split(" ")[0] ?? ""),
  );
  let alerted = 0;
  for (const w of data || []) {
    const barber = (w.barbers?.slug || "any") as BarberChoice;
    const service = w.services?.slug;
    if (!service) continue;
    if ((w.offer_count ?? 0) >= 2) continue;
    if (w.offered_at && now - new Date(w.offered_at).getTime() < OFFER_MS)
      continue;
    const channel = w.phone && smsReady ? "sms" : w.email ? "email" : null;
    if (!channel) continue;
    const first =
      (w.preferred_date as string) < today ? today : w.preferred_date;
    const last = (w.until_date as string | null) ?? w.preferred_date;
    for (let day = first; day <= last; day = addDays(day, 1)) {
      if (offeredDays.has(day)) continue;
      const slots = makeSlots(
        day,
        barber,
        service,
        await busyFor(day, barber),
        catalog,
      );
      if (!slots.length) continue;
      const slot = `${day} ${slots[0].time ?? ""}`.trim();
      const { error: queue } = await db.from("notification_jobs").upsert(
        {
          dedupe_key: `waitlist-offer-${w.id}-${(w.offer_count ?? 0) + 1}`,
          kind: "waitlist_alert",
          channel,
          payload: {
            email: w.email,
            phone: w.phone,
            day,
            url:
              siteUrl() +
              `/book?barber=${barber}&service=${service}&date=${day}`,
          },
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      );
      if (queue) break;
      await db
        .from("waitlist_requests")
        .update({
          offered_at: new Date().toISOString(),
          offered_slot: slot,
          offer_count: (w.offer_count ?? 0) + 1,
        })
        .eq("id", w.id);
      offeredDays.add(day);
      alerted++;
      break;
    }
  }
  // Anyone whose last day has passed comes off the list.
  await db
    .from("waitlist_requests")
    .update({ active: false })
    .eq("active", true)
    .lt("preferred_date", today)
    .or(`until_date.is.null,until_date.lt.${today}`);
  return alerted;
}
