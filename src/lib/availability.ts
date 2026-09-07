import "server-only";
import { createAdminClient, hasSupabase } from "./supabase/admin";
import {
  BARBERS,
  parseDate,
  type BarberChoice,
  type BarberId,
  type BusyPeriod,
} from "./booking-data";
export async function busyFor(
  date: string,
  barber: BarberChoice,
): Promise<BusyPeriod[]> {
  const barbers =
    barber === "any" ? (Object.keys(BARBERS) as BarberId[]) : [barber];
  if (!hasSupabase())
    return barbers.map((barber) => ({ barber, start: 780, duration: 30 }));
  const db = createAdminClient();
  const { data: rows, error } = await db
    .from("barbers")
    .select("id,slug")
    .in("slug", barbers)
    .eq("active", true);
  if (error) throw new Error("Availability could not load");
  const ids = rows.map((b) => b.id),
    slugs = new Map(rows.map((b) => [b.id, b.slug as BarberId]));
  const [bookings, blocks, schedules] = await Promise.all([
    db
      .from("bookings")
      .select("barber_id,start_minute,duration")
      .eq("local_date", date)
      .in("barber_id", ids)
      .in("status", ["booked", "arrived"]),
    db
      .from("diary_blocks")
      .select("barber_id,start_minute,duration")
      .eq("local_date", date)
      .in("barber_id", ids),
    db
      .from("barber_schedules")
      .select("*")
      .eq("iso_weekday", parseDate(date).getUTCDay() || 7)
      .in("barber_id", ids),
  ]);
  if (bookings.error || blocks.error || schedules.error)
    throw new Error("Availability could not load");
  const busy: BusyPeriod[] = [...bookings.data, ...blocks.data].map((b) => ({
    barber: slugs.get(b.barber_id)!,
    start: b.start_minute,
    duration: b.duration,
  }));
  for (const b of barbers)
    if (!rows.some((r) => r.slug === b))
      busy.push({ barber: b, start: 0, duration: 1440 });
  for (const s of schedules.data) {
    const b = slugs.get(s.barber_id)!;
    if (s.open_minute === null)
      busy.push({ barber: b, start: 0, duration: 1440 });
    else {
      busy.push(
        { barber: b, start: 0, duration: s.open_minute },
        { barber: b, start: s.close_minute, duration: 1440 - s.close_minute },
      );
    }
  }
  return busy;
}
