/**
 * What a barber is owed for a period.
 *
 * sales      the booked prices of trims marked done on their chair
 * card/cash  how those were paid, from Checkout
 * share      the percentage of sales the barber keeps
 * rent       a fixed weekly amount the barber pays the shop, charged once per
 *            week of the period (a part week counts as a week)
 * keepsCash  true when barbers pocket cash on the day, so cash is already
 *            in their hands and comes off what the shop transfers
 *
 * A negative result means the barber owes the shop for the period.
 */
export type PayoutInput = {
  salesPence: number;
  cardPence: number;
  cashPence: number;
  sharePercent: number;
  weeklyRentPence: number;
  keepsCash: boolean;
  days: number;
};

export function weeksIn(days: number) {
  return Math.max(1, Math.round(days / 7));
}

export function computePayout(input: PayoutInput) {
  const gross = Math.round((input.salesPence * input.sharePercent) / 100);
  const rent = input.weeklyRentPence * weeksIn(input.days);
  const cashKept = input.keepsCash ? input.cashPence : 0;
  return {
    grossPence: gross,
    rentPence: rent,
    cashKeptPence: cashKept,
    netPence: gross - rent - cashKept,
  };
}

/** Days in an inclusive date range of ISO dates. */
export function daysInRange(from: string, to: string) {
  const day = (d: string) =>
    Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
  return Math.max(1, day(to) - day(from) + 1);
}
