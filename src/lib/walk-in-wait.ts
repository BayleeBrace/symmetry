import "server-only";
import { busyFor } from "./availability";
import { getCatalog } from "./catalog";
import {
  BARBERS,
  parseDate,
  shopMinute,
  shopToday,
  type BarberId,
} from "./booking-data";
import { createAdminClient, hasSupabase } from "./supabase/admin";
import { estimateWait, type WalkIn } from "./walk-in";

/**
 * How long a walk-in would wait right now, from today's diary. Null when it
 * can't be worked out, so the page simply leaves the line out.
 */
export async function currentWalkInWait(): Promise<WalkIn | null> {
  try {
    const today = shopToday();
    const minute = shopMinute();
    const catalog = await getCatalog();
    const hours = catalog.hours[parseDate(today).getUTCDay()] ?? null;
    if (!hours || minute < hours[0] || minute >= hours[1])
      return { state: "closed" };
    // Each barber's usual cut, or their shortest service if they don't list one.
    const cut = catalog.services.find((s) => s.id === "cut");
    const durations: Partial<Record<BarberId, number>> = {};
    for (const b of Object.keys(BARBERS) as BarberId[]) {
      const own = cut?.barbers[b]?.duration;
      const shortest = Math.min(
        ...catalog.services.map((s) => s.barbers[b]?.duration ?? Infinity),
      );
      const d = own ?? shortest;
      if (Number.isFinite(d)) durations[b] = d;
    }
    const [busy, delays] = await Promise.all([
      busyFor(today, "any"),
      runningBehind(),
    ]);
    return estimateWait({ minute, hours, busy, durations, delays });
  } catch {
    return null;
  }
}

/**
 * Minutes each chair is still running behind, from the "Running behind" a
 * barber reported in the staff app within the last hour, less the time since.
 */
async function runningBehind(): Promise<Partial<Record<BarberId, number>>> {
  if (!hasSupabase()) return {};
  try {
    const { data, error } = await createAdminClient()
      .from("booking_events")
      .select("created_at,detail,bookings(barbers(slug))")
      .eq("kind", "staff_action")
      .eq("detail->>action", "running_behind")
      .gte("created_at", new Date(Date.now() - 3600000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data) return {};
    const delays: Partial<Record<BarberId, number>> = {};
    for (const row of data) {
      const slug = (
        row.bookings as unknown as { barbers: { slug: BarberId } | null } | null
      )?.barbers?.slug;
      const minutes = Number(
        (row.detail as { minutes?: unknown } | null)?.minutes,
      );
      if (!slug || !Number.isFinite(minutes) || slug in delays) continue;
      const since = (Date.now() - new Date(row.created_at).getTime()) / 60000;
      delays[slug] = Math.max(0, Math.round(minutes - since));
    }
    return delays;
  } catch {
    return {};
  }
}
