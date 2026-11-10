/**
 * Start times for trims staff add, squeeze-ins included. Plain maths on
 * minutes since midnight, so it can be checked in tests.
 *
 * A squeeze-in is a trim booked over one already in the chair, the way
 * Fresha does it: someone walks in and there's time for a quick cut before
 * the next client. Staff can do it; online bookings never overlap.
 */

/** The soonest start the diary accepts today: the next five-minute mark. A start that has gone is refused. */
export function soonestStart(nowMinute: number) {
  return Math.floor(nowMinute / 5) * 5 + 5;
}

/** Where a trim squeezed in alongside an open one starts: with it, or now if it has already begun. */
export function squeezeStart(
  trim: { local_date: string; start_minute: number },
  today: string,
  nowMinute: number,
) {
  return trim.local_date === today
    ? Math.max(trim.start_minute, soonestStart(nowMinute))
    : trim.start_minute;
}

/**
 * The start times to offer: every quarter hour a trim of `duration` fits in
 * the chair's working hours, taken or not, plus the soonest start today and
 * the time that was asked for. Nothing that has already gone today.
 */
export function startChoices({
  working,
  duration,
  isToday,
  nowMinute,
  asked,
}: {
  working: [number, number] | null;
  duration: number;
  isToday: boolean;
  nowMinute: number;
  asked: number | null;
}) {
  if (!working) return [];
  const earliest = Math.max(
    working[0],
    isToday ? soonestStart(nowMinute) : working[0],
  );
  const last = working[1] - duration;
  const out = new Set<number>();
  for (let m = working[0]; m <= last; m += 15) if (m >= earliest) out.add(m);
  for (const m of [isToday ? earliest : null, asked])
    if (m !== null && m >= earliest && m <= last) out.add(m);
  return [...out].sort((a, b) => a - b);
}

/** Whether a trim of `duration` starting at `minute` runs into any of these [start, end) spans. */
export function clashes(
  spans: [number, number][],
  minute: number,
  duration: number,
) {
  return spans.some(([s, e]) => minute < e && minute + duration > s);
}
