import "server-only";
import { busyFor } from "./availability";
import { getCatalog } from "./catalog";
import {
  addDays,
  makeSlots,
  parseDate,
  shopToday,
  type BarberChoice,
  type Slot,
} from "./booking-data";

/**
 * The soonest times for a service: the earliest free slot on each of the next
 * few open days that have space, looking up to three weeks ahead.
 */
export async function nextFree(
  barber: BarberChoice,
  service: string,
  { days = 21, limit = 3 }: { days?: number; limit?: number } = {},
): Promise<(Slot & { date: string })[]> {
  const catalog = await getCatalog();
  if (!catalog.services.some((s) => s.id === service)) return [];
  const today = shopToday();
  const found: (Slot & { date: string })[] = [];
  for (let i = 0; i < days && found.length < limit; i++) {
    const date = addDays(today, i);
    if (!catalog.hours[parseDate(date).getUTCDay()]) continue;
    const [first] = makeSlots(
      date,
      barber,
      service,
      await busyFor(date, barber),
      catalog,
    );
    if (first) found.push({ ...first, date });
  }
  return found;
}
