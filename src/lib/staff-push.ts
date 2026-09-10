import "server-only";
import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";
import {
  addDays,
  clock,
  parseDate,
  shopMinute,
  shopToday,
} from "./booking-data";
import {
  type PushKind,
  type PushMessage,
  dayAheadShopText,
  dayAheadText,
  overdueText,
} from "./push-kinds";

/**
 * Push notifications to the team's phones. Sent straight away from the
 * request that caused them (a booking, a cancellation), so they work without
 * the once-a-minute sender; only the evening brief and the no-show nudge come
 * from the cron. Nothing here ever throws into a booking: a push that fails
 * is a push that fails.
 */
export const pushConfigured = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

type Member = {
  user_id: string;
  role: string;
  barber_id: string | null;
  notify?: Record<string, boolean> | null;
};

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
) {
  if (!pushConfigured())
    return {
      sent: 0,
      devices: 0,
      off: "Push is not set up yet: add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Vercel and redeploy.",
    };
  const ids = [...new Set(userIds)];
  if (!ids.length) return { sent: 0, devices: 0 };
  const db = createAdminClient();
  const { data: rows } = await db
    .from("staff_members")
    .select("*")
    .in("user_id", ids)
    .eq("active", true);
  const wanted = ((rows as Member[]) || [])
    .filter((r) => opts.force || (r.notify ?? {})[message.kind] !== false)
    .map((r) => r.user_id);
  if (!wanted.length) return { sent: 0, devices: 0 };
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
  await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          JSON.stringify({
            title: message.title,
            body: message.body,
            url: message.url ?? "/staff",
            tag: message.tag ?? message.kind,
          }),
          { timeout: 8000, TTL: 3600 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode || 0;
        // The phone has withdrawn permission or reinstalled: forget it.
        if (code === 404 || code === 410)
          await db.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }),
  );
  return { sent, devices: subs?.length ?? 0 };
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

/**
 * From the cron: the evening-before brief (six o'clock) and the no-show
 * nudge ten minutes after a trim was due with nobody marked in the chair.
 */
export async function sendStaffBriefs() {
  if (!pushConfigured()) return { dayAhead: 0, overdue: 0 };
  const db = createAdminClient();
  const all = await members();
  const today = shopToday();
  const now = shopMinute();
  let dayAhead = 0;
  let overdue = 0;

  if (now >= 1080 && now < 1140) {
    const tomorrow = addDays(today, 1);
    const [{ data: rows }, { data: chairs }] = await Promise.all([
      db
        .from("bookings")
        .select("barber_id,start_minute")
        .eq("local_date", tomorrow)
        .in("status", ["booked", "arrived"])
        .order("start_minute"),
      db
        .from("barbers")
        .select("id,name,display_order")
        .eq("active", true)
        .order("display_order"),
    ]);
    const trims = rows || [];
    for (const m of all) {
      if (!(await claim(`day-ahead-${tomorrow}-${m.user_id}`, "day_ahead")))
        continue;
      const mine = trims.filter((t) => t.barber_id === m.barber_id);
      const body =
        m.role === "owner"
          ? dayAheadShopText(
              (chairs || []).map((c) => ({
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
  return { dayAhead, overdue };
}
