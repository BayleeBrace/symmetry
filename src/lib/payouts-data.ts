import "server-only";
import { createAdminClient } from "./supabase/admin";
import { addDays } from "./booking-data";
import { computePayout, daysInRange, rentWeeksDue } from "./payouts-calc";

/**
 * Every chair's figures for a period, the way the Payouts screen shows them.
 * Shared by the Payouts API and the Monday payday push so the two never
 * disagree.
 */
export type PayoutRule = {
  barber_id: string;
  share_percent: number;
  weekly_rent_pence: number;
  keeps_cash: boolean;
  bank_name: string;
  bank_sort_code: string;
  bank_account: string;
};

export const defaultRule = (barber_id: string): PayoutRule => ({
  barber_id,
  share_percent: 100,
  weekly_rent_pence: 0,
  keeps_cash: true,
  bank_name: "",
  bank_sort_code: "",
  bank_account: "",
});

export type PayoutItem = {
  barber: { id: string; name: string; owner: boolean };
  rule: PayoutRule;
  trims: number;
  salesPence: number;
  cardPence: number;
  cashPence: number;
  unrecordedPence: number;
  grossPence: number;
  rentPence: number;
  cashKeptPence: number;
  netPence: number;
  rentWeeks: number;
  paid: {
    id: string;
    amount_pence: number;
    paid_at: string;
    note: string;
  } | null;
};

export async function payoutFigures(
  from: string,
  to: string,
  opts: { barberId?: string } = {},
) {
  const db = createAdminClient();
  let trims = db
    .from("bookings")
    .select("barber_id,price_pence,paid_by,status")
    .gte("local_date", from)
    .lte("local_date", to)
    .eq("status", "done")
    .limit(5000);
  if (opts.barberId) trims = trims.eq("barber_id", opts.barberId);
  const [barbers, members, rules, done, paid] = await Promise.all([
    db
      .from("barbers")
      .select("id,name,slug,active")
      .eq("active", true)
      .order("display_order"),
    db.from("staff_members").select("barber_id,role").eq("active", true),
    db.from("payout_rules").select("*"),
    trims,
    // Every payout that touches this period's weeks, so rent is never charged twice in a week.
    db
      .from("payouts")
      .select("*")
      .gte("period_end", addDays(from, -7))
      .lte("period_start", addDays(to, 7)),
  ]);
  if (barbers.error || members.error || rules.error || done.error || paid.error)
    throw new Error(
      "Payouts could not load. Has the payouts migration been applied?",
    );
  const ownerChairs = new Set(
    members.data.filter((m) => m.role === "owner").map((m) => m.barber_id),
  );
  const items: PayoutItem[] = barbers.data
    .filter((b) => !opts.barberId || b.id === opts.barberId)
    .map((b) => {
      const rule =
        (rules.data as PayoutRule[]).find((r) => r.barber_id === b.id) ??
        defaultRule(b.id);
      const mine = done.data.filter((t) => t.barber_id === b.id);
      const sum = (rows: typeof mine) =>
        rows.reduce((s, t) => s + t.price_pence, 0);
      const salesPence = sum(mine);
      const cardPence = sum(mine.filter((t) => t.paid_by === "card"));
      const cashPence = sum(mine.filter((t) => t.paid_by === "cash"));
      const record =
        paid.data.find(
          (p) =>
            p.barber_id === b.id &&
            p.period_start === from &&
            p.period_end === to,
        ) ?? null;
      const rentWeeks = rentWeeksDue(
        from,
        to,
        paid.data.filter(
          (p) => p.barber_id === b.id && (!record || p.id !== record.id),
        ),
      );
      const figures = computePayout({
        salesPence,
        cardPence,
        cashPence,
        sharePercent: rule.share_percent,
        weeklyRentPence: rule.weekly_rent_pence,
        rentWeeks,
        keepsCash: rule.keeps_cash,
      });
      return {
        barber: { id: b.id, name: b.name, owner: ownerChairs.has(b.id) },
        rule,
        trims: mine.length,
        salesPence,
        cardPence,
        cashPence,
        unrecordedPence: sum(
          mine.filter((t) => t.paid_by !== "card" && t.paid_by !== "cash"),
        ),
        ...figures,
        rentWeeks,
        paid: record
          ? {
              id: record.id,
              amount_pence: record.amount_pence,
              paid_at: record.paid_at,
              note: record.note,
            }
          : null,
      };
    });
  return { items, days: daysInRange(from, to), barbers: barbers.data };
}
