import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson, publicError, sameOrigin } from "@/lib/security";
import { addDays, shopToday, validDate } from "@/lib/booking-data";
import { payoutFigures } from "@/lib/payouts-data";

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
    let history = db
      .from("payouts")
      .select("*")
      .order("paid_at", { ascending: false })
      .limit(40);
    if (!owner) history = history.eq("barber_id", staff.barber_id);
    const [{ items: figures, days, barbers }, past] = await Promise.all([
      payoutFigures(from, to, owner ? {} : { barberId: staff.barber_id }),
      history,
    ]);
    if (past.error)
      throw new Error(
        "Payouts could not load. Has the payouts migration been applied?",
      );
    // Barbers see their own figures, never anyone's bank details.
    const items = figures.map((i) =>
      owner
        ? i
        : {
            ...i,
            rule: {
              ...i.rule,
              bank_name: "",
              bank_sort_code: "",
              bank_account: "",
            },
          },
    );

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
    const names = new Map(barbers.map((b) => [b.id, b.name]));
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
