import "server-only";
import { createAdminClient } from "./supabase/admin";
import { signLink, siteUrl } from "./security";
import { addDays, shopMinute, shopToday } from "./booking-data";
import { daysBetween, reminderDue, usualGapDays } from "./rebook-gap";

type Last = { date: string; barber_id: string; service_id: string };
type Embedded = { customer_id: string };

/**
 * Once a day, after 10am, queue a "Time for a trim?" email for customers who
 * ticked the reminder box, are a week past their usual gap, have nothing
 * booked, and have not been nudged in the last two months.
 */
export async function queueRebookNudges() {
  const today = shopToday();
  if (shopMinute() < 600)
    return { queued: 0, skipped: "Reminders go out after 10am" };
  const db = createAdminClient();
  const { error: claimError } = await db.from("notification_jobs").insert({
    dedupe_key: "nudge-run-" + today,
    kind: "nudge_run",
    channel: "push",
    status: "sent",
  });
  if (claimError?.code === "23505")
    return { queued: 0, skipped: "Already ran today" };
  if (claimError) throw new Error("Reminder run could not be claimed");

  const { data: done, error } = await db
    .from("bookings")
    .select("local_date,barber_id,service_id,booking_groups!inner(customer_id)")
    .eq("status", "done")
    .gte("local_date", addDays(today, -365))
    .order("local_date")
    .limit(5000);
  if (error) throw new Error("Reminder history could not load");
  const byCustomer = new Map<string, { dates: string[]; last: Last }>();
  for (const b of done || []) {
    const id = (b.booking_groups as unknown as Embedded).customer_id;
    const visit = {
      date: b.local_date,
      barber_id: b.barber_id,
      service_id: b.service_id,
    };
    const entry: { dates: string[]; last: Last } = byCustomer.get(id) ?? {
      dates: [],
      last: visit,
    };
    entry.dates.push(b.local_date);
    if (b.local_date >= entry.last.date) entry.last = visit;
    byCustomer.set(id, entry);
  }
  const due = [...byCustomer]
    .filter(([, v]) => reminderDue(today, v.last.date, usualGapDays(v.dates)))
    .map(([id]) => id);
  if (!due.length) return { queued: 0 };

  const [customers, consents, upcoming, barbers, services] = await Promise.all([
    db.from("customers").select("id,name,email,last_nudged_at").in("id", due),
    db
      .from("email_marketing_consents")
      .select("customer_id,granted,recorded_at")
      .in("customer_id", due)
      .order("recorded_at", { ascending: false }),
    db
      .from("bookings")
      .select("booking_groups!inner(customer_id)")
      .in("booking_groups.customer_id", due)
      .in("status", ["booked", "arrived"])
      .gte("local_date", today),
    db.from("barbers").select("id,slug,name"),
    db.from("services").select("id,slug,name"),
  ]);
  if (
    customers.error ||
    consents.error ||
    upcoming.error ||
    barbers.error ||
    services.error
  )
    throw new Error("Reminder details could not load");
  const latestConsent = new Map<string, boolean>();
  for (const c of consents.data)
    if (!latestConsent.has(c.customer_id))
      latestConsent.set(c.customer_id, c.granted);
  const booked = new Set(
    upcoming.data.map(
      (b) => (b.booking_groups as unknown as Embedded).customer_id,
    ),
  );
  const twoMonthsAgo = Date.now() - 60 * 86400000;
  let queued = 0;
  for (const c of customers.data) {
    if (queued >= 50) break;
    if (!latestConsent.get(c.id) || booked.has(c.id) || !c.email) continue;
    if (c.last_nudged_at && new Date(c.last_nudged_at).getTime() > twoMonthsAgo)
      continue;
    const { last } = byCustomer.get(c.id)!;
    const barber = barbers.data.find((b) => b.id === last.barber_id);
    const service = services.data.find((s) => s.id === last.service_id);
    if (!barber || !service) continue;
    const { error: queue } = await db.from("notification_jobs").upsert(
      {
        dedupe_key: `nudge-${c.id}-${today}`,
        kind: "nudge",
        channel: "email",
        payload: {
          customer_id: c.id,
          email: c.email,
          name: c.name,
          barber: barber.name,
          service: service.name,
          weeks: Math.max(1, Math.round(daysBetween(last.date, today) / 7)),
          url: `${siteUrl()}/book?barber=${barber.slug}&service=${service.slug}`,
          stop: `${siteUrl()}/api/reminders/stop?token=${signLink("reminders-stop", c.id, 60 * 60 * 24 * 365)}`,
        },
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
    if (queue) continue;
    await db
      .from("customers")
      .update({ last_nudged_at: new Date().toISOString() })
      .eq("id", c.id);
    queued++;
  }
  return { queued };
}
