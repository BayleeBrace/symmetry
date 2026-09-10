import "server-only";
import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";
import { getCatalog } from "./catalog";
import {
  addDays,
  clock,
  parseDate,
  shopMinute,
  shopToday,
} from "./booking-data";
import { payoutFigures } from "./payouts-data";
import {
  type PushKind,
  type PushMessage,
  dayAheadShopText,
  dayAheadText,
  dayEndShopText,
  dayEndText,
  overdueText,
  paydayBarberText,
  paydayOwnerText,
} from "./push-kinds";

/**
 * Push notifications to the team's phones. Sent straight away from the
 * request that caused them (a booking, a cancellation), so they work without
 * the once-a-minute sender; the evening brief, the no-show nudge, the
 * end-of-day figures and Monday's payday come from the cron. Nothing here
 * ever throws into a booking: a push that fails is a push that fails.
 */
export const pushConfigured = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

/** A plain-English reason the keys in Vercel cannot work, or null when they look right. */
export function vapidProblem() {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  if (!pub || !priv)
    return "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not set in Vercel.";
  const bytes = (v: string) => {
    try {
      return Buffer.from(v, "base64url").length;
    } catch {
      return 0;
    }
  };
  if (bytes(priv) !== 32)
    return `VAPID_PRIVATE_KEY in Vercel is not a valid key (${priv.length} characters, decodes to ${bytes(priv)} bytes, needs 32). Paste the 43-character value from vercel-env.txt again with nothing before or after it, then redeploy.`;
  if (bytes(pub) !== 65)
    return `VAPID_PUBLIC_KEY in Vercel is not a valid key (${pub.length} characters, decodes to ${bytes(pub)} bytes, needs 65). Paste the 87-character value again, then redeploy.`;
  return null;
}

type Member = {
  user_id: string;
  role: string;
  barber_id: string | null;
  notify?: Record<string, boolean> | null;
};

export type PushOutcome = { status: number; error?: string };

async function members(): Promise<Member[]> {
  const { data } = await createAdminClient()
    .from("staff_members")
    .select("*")
    .eq("active", true);
  return (data as Member[]) || [];
}

/** Who hears about a chair: its barber, and the owners unless chairOnly. Never whoever did it. */
function audience(
  all: Member[],
  barberId: string | null | undefined,
  opts: { except?: string | null; chairOnly?: boolean } = {},
) {
  const chair = all.filter((m) => barberId && m.barber_id === barberId);
  const picked = opts.chairOnly
    ? chair.length
      ? chair
      : all.filter((m) => m.role === "owner")
    : all.filter((m) => m.role === "owner" || chair.includes(m));
  return picked.filter((m) => m.user_id !== opts.except).map((m) => m.user_id);
}

/** Send one message to these staff, on every phone they have enabled, unless they switched that kind off. */
export async function sendStaffPush(
  userIds: string[],
  message: PushMessage,
  opts: { force?: boolean } = {},
): Promise<{
  sent: number;
  devices: number;
  outcomes: PushOutcome[];
  off?: string;
}> {
  if (!pushConfigured())
    return {
      sent: 0,
      devices: 0,
      outcomes: [],
      off: "Push is not set up yet: add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel and redeploy.",
    };
  const ids = [...new Set(userIds)];
  if (!ids.length) return { sent: 0, devices: 0, outcomes: [] };
  const db = createAdminClient();
  const { data: rows } = await db
    .from("staff_members")
    .select("*")
    .in("user_id", ids)
    .eq("active", true);
  const wanted = ((rows as Member[]) || [])
    .filter((r) => opts.force || (r.notify ?? {})[message.kind] !== false)
    .map((r) => r.user_id);
  if (!wanted.length) return { sent: 0, devices: 0, outcomes: [] };
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || "mailto:info@symmetrywales.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id,subscription")
    .in("staff_user", wanted);
  let sent = 0;
  const outcomes: PushOutcome[] = [];
  await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        const r = await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          JSON.stringify({
            title: message.title,
            body: message.body,
            url: message.url ?? "/staff",
            tag: message.tag ?? message.kind,
          }),
          { timeout: 8000, TTL: 3600, urgency: "high" },
        );
        sent++;
        outcomes.push({ status: r.statusCode });
      } catch (e) {
        const err = e as {
          statusCode?: number;
          body?: string;
          message?: string;
        };
        const code = err.statusCode || 0;
        outcomes.push({
          status: code,
          error: (err.body || err.message || "").slice(0, 160),
        });
        // The phone has withdrawn permission or reinstalled: forget it.
        if (code === 404 || code === 410)
          await db.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }),
  );
  return { sent, devices: subs?.length ?? 0, outcomes };
}

const when = (date: string, minute: number) =>
  `${new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDate(date))} at ${clock(minute)}`;

/** What a push says about a trim: day, time, service and chair. Never the customer's name. */
export async function trimLine(bookingId: string) {
  const { data: b } = await createAdminClient()
    .from("bookings")
    .select("barber_id,local_date,start_minute,services(name),barbers(name)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) return null;
  const service =
    (b.services as unknown as { name: string } | null)?.name ?? "trim";
  const barber =
    (b.barbers as unknown as { name: string } | null)?.name ?? "the chair";
  return {
    barberId: b.barber_id as string,
    date: b.local_date as string,
    text: `${when(b.local_date, b.start_minute)}, ${service.toLowerCase()} with ${barber}.`,
  };
}

/** The name to say who did something: the barber's name, or "The owner". */
export async function staffName(staff: {
  barber_id: string | null;
  role: string;
}) {
  if (staff.barber_id) {
    const { data } = await createAdminClient()
      .from("barbers")
      .select("name")
      .eq("id", staff.barber_id)
      .maybeSingle();
    if (data?.name) return data.name as string;
  }
  return staff.role === "owner" ? "The owner" : "Someone on the team";
}

/** Tell the right people about one trim. Safe inside a request: never throws. */
export async function notifyTrim(
  kind: PushKind,
  bookingId: string,
  opts: {
    title: string;
    lead?: string;
    except?: string | null;
    chairOnly?: boolean;
  },
) {
  try {
    if (!pushConfigured()) return;
    const line = await trimLine(bookingId);
    if (!line) return;
    const to = audience(await members(), line.barberId, {
      except: opts.except,
      chairOnly: opts.chairOnly,
    });
    await sendStaffPush(to, {
      kind,
      title: opts.title,
      body: (opts.lead ? opts.lead + " " : "") + line.text,
      url: `/staff?date=${line.date}`,
      tag: `${kind}-${bookingId}`,
    });
  } catch {}
}

/** Claim a once-only key. False when it was already claimed by an earlier run. */
async function claim(key: string, kind: PushKind) {
  const { data } = await createAdminClient()
    .from("notification_jobs")
    .insert({
      dedupe_key: key,
      kind: "staff_push",
      channel: "push",
      status: "sent",
      payload: { kind },
    })
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

type Takings = {
  count: number;
  cardPence: number;
  cashPence: number;
  otherPence: number;
};

function takings(
  rows: { barber_id: string; price_pence: number; paid_by: string | null }[],
  barberId: string | null,
): Takings {
  const mine = rows.filter((r) => r.barber_id === barberId);
  const sum = (f: (r: (typeof mine)[number]) => boolean) =>
    mine.filter(f).reduce((s, r) => s + r.price_pence, 0);
  return {
    count: mine.length,
    cardPence: sum((r) => r.paid_by === "card"),
    cashPence: sum((r) => r.paid_by === "cash"),
    otherPence: sum((r) => r.paid_by !== "card" && r.paid_by !== "cash"),
  };
}

/**
 * From the cron, once each: the evening-before brief (six o'clock), the
 * no-show nudge ten minutes after a trim was due with nobody marked in the
 * chair, the end-of-day figures at closing, and Monday morning's payday.
 */
export async function sendStaffBriefs() {
  if (!pushConfigured())
    return { dayAhead: 0, overdue: 0, dayEnd: 0, payday: 0 };
  const db = createAdminClient();
  const all = await members();
  const today = shopToday();
  const now = shopMinute();
  const { data: chairRows } = await db
    .from("barbers")
    .select("id,name,display_order")
    .eq("active", true)
    .order("display_order");
  const chairs = chairRows || [];
  let dayAhead = 0;
  let overdue = 0;
  let dayEnd = 0;
  let payday = 0;

  // Six in the evening: tomorrow's brief.
  if (now >= 1080 && now < 1140) {
    const tomorrow = addDays(today, 1);
    const { data: rows } = await db
      .from("bookings")
      .select("barber_id,start_minute")
      .eq("local_date", tomorrow)
      .in("status", ["booked", "arrived"])
      .order("start_minute");
    const trims = rows || [];
    for (const m of all) {
      if (!(await claim(`day-ahead-${tomorrow}-${m.user_id}`, "day_ahead")))
        continue;
      const mine = trims.filter((t) => t.barber_id === m.barber_id);
      const body =
        m.role === "owner"
          ? dayAheadShopText(
              chairs.map((c) => ({
                name: c.name,
                count: trims.filter((t) => t.barber_id === c.id).length,
              })),
              trims[0] ? clock(trims[0].start_minute) : null,
            )
          : dayAheadText(
              mine.length,
              mine[0] ? clock(mine[0].start_minute) : null,
            );
      const r = await sendStaffPush([m.user_id], {
        kind: "day_ahead",
        title: "Tomorrow",
        body,
        url: `/staff?date=${tomorrow}`,
        tag: "day-ahead",
      });
      dayAhead += r.sent;
    }
  }

  // Ten minutes past a booked start with nobody marked in the chair.
  const { data: late } = await db
    .from("bookings")
    .select("id,barber_id,start_minute")
    .eq("local_date", today)
    .eq("status", "booked")
    .lte("start_minute", now - 10)
    .gt("start_minute", now - 60);
  for (const b of late || []) {
    if (!(await claim(`overdue-${b.id}`, "overdue"))) continue;
    const r = await sendStaffPush(
      audience(all, b.barber_id, { chairOnly: true }),
      {
        kind: "overdue",
        title: "Not in the chair yet",
        body: overdueText(clock(b.start_minute)),
        url: `/staff?date=${today}`,
        tag: `overdue-${b.id}`,
      },
    );
    overdue += r.sent;
  }

  // Closing time: today's trims, card and cash, for each chair and the shop.
  const catalog = await getCatalog();
  const hours = catalog.hours[parseDate(today).getUTCDay()] ?? null;
  if (hours && now >= hours[1] && now < hours[1] + 240) {
    const { data: done } = await db
      .from("bookings")
      .select("barber_id,price_pence,paid_by")
      .eq("local_date", today)
      .eq("status", "done");
    const rows = done || [];
    for (const m of all) {
      const mine = takings(rows, m.barber_id);
      const body =
        m.role === "owner"
          ? dayEndShopText(
              chairs.map((c) => ({ name: c.name, ...takings(rows, c.id) })),
            )
          : dayEndText(mine);
      // A barber who was off today hears nothing; the owner hears when the shop took anything.
      if (m.role === "owner" ? !rows.length : !mine.count) continue;
      if (!(await claim(`day-end-${today}-${m.user_id}`, "day_end"))) continue;
      const r = await sendStaffPush([m.user_id], {
        kind: "day_end",
        title: "Today",
        body,
        url: "/staff?section=sales",
        tag: "day-end",
      });
      dayEnd += r.sent;
    }
  }

  // Monday, nine in the morning: last week's pay.
  const isMonday = (parseDate(today).getUTCDay() + 6) % 7 === 0;
  if (isMonday && now >= 540 && now < 600) {
    const from = addDays(today, -7);
    const to = addDays(today, -1);
    const { items } = await payoutFigures(from, to).catch(() => ({
      items: [],
    }));
    for (const m of all) {
      let body: string;
      if (m.role === "owner")
        body = paydayOwnerText(
          items
            .filter((i) => !i.barber.owner)
            .map((i) => ({
              name: i.barber.name,
              netPence: i.netPence,
              paid: Boolean(i.paid),
            })),
        );
      else {
        const mine = items.find((i) => i.barber.id === m.barber_id);
        if (!mine) continue;
        body = paydayBarberText({
          salesPence: mine.salesPence,
          netPence: mine.netPence,
          rentPence: mine.rentPence,
          paid: Boolean(mine.paid),
        });
      }
      if (!(await claim(`payday-${today}-${m.user_id}`, "payday"))) continue;
      const r = await sendStaffPush([m.user_id], {
        kind: "payday",
        title: "Payday",
        body,
        url: "/staff?section=payouts",
        tag: "payday",
      });
      payday += r.sent;
    }
  }
  return { dayAhead, overdue, dayEnd, payday };
}
