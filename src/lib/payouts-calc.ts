/**
 * What a barber is owed for a period.
 *
 * The boys are self-employed: they keep their takings, keep the cash they
 * take on the day, and pay the shop a fixed weekly rent for the chair.
 *
 * sales      the booked prices of trims marked done on their chair
 * card/cash  how those were paid, from Checkout
 * share      the percentage of sales the barber keeps (100 unless the shop
 *            takes a cut instead of, or as well as, rent)
 * rentWeeks  how many calendar weeks of rent this payout should carry: every
 *            Monday-to-Sunday week the period touches that has not already
 *            been charged in an earlier payout
 * keepsCash  cash is already in the barber's hands, so it comes off what the
 *            shop transfers
 *
 * A negative result means the barber owes the shop for the period.
 */
export type PayoutInput = {
  salesPence: number;
  cardPence: number;
  cashPence: number;
  sharePercent: number;
  weeklyRentPence: number;
  rentWeeks: number;
  keepsCash: boolean;
};

export function computePayout(input: PayoutInput) {
  const gross = Math.round((input.salesPence * input.sharePercent) / 100);
  const rent = input.weeklyRentPence * input.rentWeeks;
  const cashKept = input.keepsCash ? input.cashPence : 0;
  return {
    grossPence: gross,
    rentPence: rent,
    cashKeptPence: cashKept,
    netPence: gross - rent - cashKept,
  };
}

const dayNumber = (d: string) =>
  Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
const isoDate = (n: number) =>
  new Date(n * 86400000).toISOString().slice(0, 10);

/** Days in an inclusive date range of ISO dates. */
export function daysInRange(from: string, to: string) {
  return Math.max(1, dayNumber(to) - dayNumber(from) + 1);
}

/** The Monday of the week an ISO date falls in. */
export function mondayOf(date: string) {
  const n = dayNumber(date);
  const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7;
  return isoDate(n - dow);
}

/** Every Monday-to-Sunday week that an inclusive date range touches, as Mondays. */
export function weeksTouched(from: string, to: string) {
  const weeks: string[] = [];
  for (let n = dayNumber(mondayOf(from)); n <= dayNumber(to); n += 7)
    weeks.push(isoDate(n));
  return weeks;
}

/**
 * Weeks of rent to charge on a payout for [from, to]: the weeks the period
 * touches, minus any week already touched by an earlier recorded payout for
 * the same barber. Paying twice in one week charges rent once.
 */
export function rentWeeksDue(
  from: string,
  to: string,
  earlier: { period_start: string; period_end: string }[],
) {
  const charged = new Set(
    earlier.flatMap((p) => weeksTouched(p.period_start, p.period_end)),
  );
  return weeksTouched(from, to).filter((w) => !charged.has(w)).length;
}
