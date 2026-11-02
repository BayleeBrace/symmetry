/** The most times one person is offered the same day. */
export const OFFERS_PER_DAY = 2;

/**
 * Who a free time on a day is offered to next: whoever has been offered that
 * day the fewest times, then whoever asked first. Everyone waiting for the
 * day gets a turn before anyone is asked again, and nobody is offered the
 * same day more than twice.
 */
export function offerOrder<T extends { id: string; created_at: string }>(
  waiting: T[],
  offersFor: (id: string) => number,
): T[] {
  return waiting
    .filter((w) => offersFor(w.id) < OFFERS_PER_DAY)
    .sort(
      (a, b) =>
        offersFor(a.id) - offersFor(b.id) ||
        Date.parse(a.created_at) - Date.parse(b.created_at) ||
        a.id.localeCompare(b.id),
    );
}
