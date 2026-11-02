import type { BarberId, BusyPeriod } from "./booking-data.ts";

/** What the website says about turning up without a booking right now. */
export type WalkIn =
  | { state: "closed" }
  | { state: "free" }
  | { state: "wait"; minutes: number }
  | { state: "later"; at: number }
  | { state: "full" };

/**
 * The soonest a walk-in could sit down, worked out from today's diary.
 *
 * For each chair: the earliest start from now (plus any "running behind" the
 * barber has reported) that leaves room for their usual cut before closing,
 * clear of bookings, breaks and their own hours. The shortest wait wins.
 * Waits are rounded up to five minutes; "free" means five minutes or less.
 */
export function estimateWait(input: {
  minute: number;
  hours: [number, number] | null;
  busy: BusyPeriod[];
  durations: Partial<Record<BarberId, number>>;
  delays?: Partial<Record<BarberId, number>>;
}): WalkIn {
  const { minute, hours, busy, durations, delays = {} } = input;
  if (!hours || minute < hours[0] || minute >= hours[1])
    return { state: "closed" };
  let soonest: number | null = null;
  for (const [barber, duration] of Object.entries(durations) as [
    BarberId,
    number | undefined,
  ][]) {
    if (!duration) continue;
    const mine = busy.filter((b) => b.barber === barber);
    const from = minute + Math.max(0, delays[barber] ?? 0);
    const candidates = [
      from,
      ...mine.map((b) => b.start + b.duration).filter((end) => end > from),
    ].sort((a, b) => a - b);
    const start = candidates.find(
      (t) =>
        t + duration <= hours[1] &&
        !mine.some((b) => t < b.start + b.duration && t + duration > b.start),
    );
    if (start !== undefined && (soonest === null || start < soonest))
      soonest = start;
  }
  if (soonest === null) return { state: "full" };
  const wait = Math.ceil((soonest - minute) / 5) * 5;
  if (wait <= 5) return { state: "free" };
  if (wait <= 60) return { state: "wait", minutes: wait };
  return { state: "later", at: Math.ceil(soonest / 5) * 5 };
}
