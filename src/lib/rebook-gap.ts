/** Four weeks when a customer has only been in once. */
export const DEFAULT_GAP_DAYS = 28;

const dayNumber = (date: string) =>
  Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) /
  86400000;

export const daysBetween = (from: string, to: string) =>
  dayNumber(to) - dayNumber(from);

/**
 * How many days a customer usually leaves between trims: the median gap
 * between their completed visits, kept between two and twelve weeks.
 */
export function usualGapDays(dates: string[]): number {
  const days = [...new Set(dates)].map(dayNumber).sort((a, b) => a - b);
  if (days.length < 2) return DEFAULT_GAP_DAYS;
  const gaps = days
    .slice(1)
    .map((d, i) => d - days[i])
    .sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return Math.min(84, Math.max(14, Math.round(median)));
}

/**
 * A reminder is due a week after the usual gap has passed, and stays due for
 * two weeks so a customer is nudged once, not chased.
 */
export function reminderDue(today: string, lastVisit: string, gapDays: number) {
  const from = dayNumber(lastVisit) + gapDays + 7;
  const now = dayNumber(today);
  return now >= from && now <= from + 14;
}
