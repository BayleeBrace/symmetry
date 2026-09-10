import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson, publicError, sameOrigin } from "@/lib/security";
import { addDays, shopToday, validDate } from "@/lib/booking-data";
import { computePayout, daysInRange, rentWeeksDue } from "@/lib/payouts-calc";

type Rule = {
  barber_id: string;
  share_percent: number;
  weekly_rent_pence: number;
  keeps_cash: boolean;
  bank_name: string;
  bank_sort_code: string;
  bank_account: string;
};

const actions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rules"),
    barber_id: z.uuid(),
    share_percent: z.number().int().min(0).max(100),
    weekly_rent_pence: z.number().int().min(0).max(10000000),
    keeps_cash: z.boolean(),
    bank_name: z.string().trim().max(80).default(""),
    bank_sort_code: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v === "" || /^\d{6}$/.test(v), "Sort code is six digits"),
    bank_account: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, ""))
      .refine(
        (v) => v === "" || /^\d{8}$/.test(v),
        "Account number is eight digits",
      ),
  }),
  z.object({
    action: z.literal("pay"),
    items: z
      .array(
        z.object({
          barber_id: z.uuid(),
          from: z.string().refine(validDate),
          to: z.string().refine(validDate),
          amount_pence: z.number().int().min(-10000000).max(10000000),
          sales_pence: z.number().int().min(0),
          card_pence: z.number().int().min(0),
          cash_pence: z.number().int().min(0),
          note: z.string().max(200).default(""),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.object({ action: z.literal("unpay"), id: z.uuid() }),
]);

const defaults = (barber_id: string): Rule => ({
  barber_id,
  share_percent: 100,
  weekly_rent_pence: 0,
  keeps_cash: true,
  bank_name: "",
  bank_sort_code: "",
  bank_account: "",
});

// Owner: every barber, the rules, the history and the bank file. Barber: their own pay only.
export async function GET(req: Request) {
  try {
    const staff = await requireStaff();
    const owner = staff.role === "owner";
    const params = new URL(req.url).searchParams;
    const today = shopToday();
    const { from, to } = z
      .object({
        from: z.string().refine(validDate),
        to: z.string().refine(validDate),
      })
      .parse({
        from: params.get("from") || addDays(today, -6),
        to: params.get("to") || today,
      });
    if (to < from || to > addDays(from, 92))
      throw new Error("Choose a period of up to three months");
    const db = createAdminClient();
    let trims = db
      .from("bookings")
      .select("barber_id,price_pence,paid_by,status")
      .gte("local_date", from)
      .lte("local_date", to)
      .eq("status", "done")
      .limit(5000);
    let history = db
      .from("payouts")
      .select("*")
      .order("paid_at", { ascending: false })
      .limit(40);
    if (!owner) {
      trims = trims.eq("barber_id", staff.barber_id);
      history = history.eq("barber_id", staff.barber_id);
    }
    const [barbers, members, rules, done, paid, past] = await Promise.all([
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
      history,
    ]);
    if (
      barbers.error ||
      members.error ||
      rules.error ||
      done.error ||
      paid.error ||
      past.error
    )
      throw new Error(
        "Payouts could not load. Has the payouts migration been applied?",
      );
    const days = daysInRange(from, to);
    const ownerChairs = new Set(
      members.data.filter((m) => m.role === "owner").map((m) => m.barber_id),
    );
    const items = barbers.data
      .filter((b) => owner || b.id === staff.barber_id)
      .map((b) => {
        const rule =
          (rules.data as Rule[]).find((r) => r.barber_id === b.id) ??
          defaults(b.id);
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
          rule: owner
            ? rule
            : {
                barber_id: b.id,
                share_percent: rule.share_percent,
                weekly_rent_pence: rule.weekly_rent_pence,
                keeps_cash: rule.keeps_cash,
                bank_name: "",
                bank_sort_code: "",
                bank_account: "",
              },
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

    if (params.get("format") === "csv") {
      if (!owner) throw new Error("Only the owner can download the bank file");
      const reference = `Symmetry ${from} to ${to}`;
      const rows = items
        .filter((i) => !i.barber.owner && i.netPence > 0)
        .map((i) =>
          [
            i.rule.bank_name || i.barber.name,
            i.rule.bank_sort_code,
            i.rule.bank_account,
            (i.netPence / 100).toFixed(2),
            reference,
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        );
      return new Response(
        ["Name,Sort code,Account number,Amount,Reference", ...rows].join(
          "\r\n",
        ) + "\r\n",
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="symmetry-payouts-${from}-to-${to}.csv"`,
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    const names = new Map(barbers.data.map((b) => [b.id, b.name]));
    return privateJson({
      from,
      to,
      days,
      items,
      history: past.data.map((p) => ({
        ...p,
        barber: names.get(p.barber_id) ?? "Chair",
      })),
    });
  } catch (e) {
    return publicError(e, 403);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff(true);
    const p = actions.parse(await req.json());
    const db = createAdminClient();
    if (p.action === "rules") {
      const { action: _action, ...values } = p;
      void _action;
      const { error } = await db
        .from("payout_rules")
        .upsert({ ...values, updated_at: new Date().toISOString() });
      if (error) throw new Error("The rules could not be saved");
      return privateJson({ ok: true });
    }
    if (p.action === "pay") {
      const { error } = await db.from("payouts").upsert(
        p.items.map((i) => ({
          barber_id: i.barber_id,
          period_start: i.from,
          period_end: i.to,
          sales_pence: i.sales_pence,
          card_pence: i.card_pence,
          cash_pence: i.cash_pence,
          amount_pence: i.amount_pence,
          note: i.note,
          paid_by: staff.user_id,
        })),
        {
          onConflict: "barber_id,period_start,period_end",
          ignoreDuplicates: true,
        },
      );
      if (error) throw new Error("The payout could not be recorded");
      return privateJson({ ok: true });
    }
    const { error } = await db.from("payouts").delete().eq("id", p.id);
    if (error) throw new Error("The payout could not be undone");
    return privateJson({ ok: true });
  } catch (e) {
    return publicError(e);
  }
}
