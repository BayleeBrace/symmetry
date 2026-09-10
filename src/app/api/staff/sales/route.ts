import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson, publicError } from "@/lib/security";
import { addDays, shopToday, validDate } from "@/lib/booking-data";

type Row = {
  id: string;
  local_date: string;
  start_minute: number;
  status: string;
  price_pence: number;
  fee_pence: number;
  fee_status: string;
  paid_by: string | null;
  barber_id: string;
  barbers: { name: string } | null;
  services: { name: string } | null;
  booking_groups: { customers: { name: string } | null } | null;
};

// Completed trims and what they were worth, for a date range of up to three months.
export async function GET(req: Request) {
  try {
    const staff = await requireStaff();
    const params = new URL(req.url).searchParams;
    const today = shopToday();
    const { from, to } = z
      .object({
        from: z.string().refine(validDate),
        to: z.string().refine(validDate),
      })
      .parse({
        from: params.get("from") || today,
        to: params.get("to") || today,
      });
    if (to < from || to > addDays(from, 92))
      throw new Error("Choose a period of up to three months");
    const db = createAdminClient();
    let query = db
      .from("bookings")
      .select(
        "id,local_date,start_minute,status,price_pence,fee_pence,fee_status,paid_by,barber_id,barbers(name),services(name),booking_groups(customers(name))",
      )
      .gte("local_date", from)
      .lte("local_date", to)
      .in("status", ["done", "no_show"])
      .order("local_date", { ascending: false })
      .order("start_minute", { ascending: false })
      .limit(1500);
    if (staff.role !== "owner") query = query.eq("barber_id", staff.barber_id);
    const { data, error } = await query;
    if (error) throw new Error("Sales could not load");
    const rows = data as unknown as Row[];
    const done = rows.filter((r) => r.status === "done");
    const byMethod: Record<string, number> = {};
    for (const r of done) {
      const key = r.paid_by ?? "none";
      byMethod[key] = (byMethod[key] ?? 0) + r.price_pence;
    }
    const { data: barbers } = await db
      .from("barbers")
      .select("id,name")
      .order("display_order");
    const byBarber = (barbers ?? [])
      .map((b) => {
        const mine = done.filter((r) => r.barber_id === b.id);
        return {
          name: b.name,
          trims: mine.length,
          sales: mine.reduce((s, r) => s + r.price_pence, 0),
        };
      })
      .filter((b) => staff.role === "owner" || b.trims > 0);
    return privateJson({
      from,
      to,
      rows: done.map((r) => ({
        id: r.id,
        local_date: r.local_date,
        start_minute: r.start_minute,
        status: r.status,
        price_pence: r.price_pence,
        fee_pence: r.fee_pence,
        fee_status: r.fee_status,
        paid_by: r.paid_by,
        barber: r.barbers?.name ?? "",
        service: r.services?.name ?? "Trim",
        client: r.booking_groups?.customers?.name ?? "Walk-in",
      })),
      totals: {
        sales: done.reduce((s, r) => s + r.price_pence, 0),
        trims: done.length,
        fees: rows
          .filter((r) => r.fee_status === "charged")
          .reduce((s, r) => s + r.fee_pence, 0),
        noShows: rows.filter((r) => r.status === "no_show").length,
        byMethod,
        byBarber,
      },
    });
  } catch (e) {
    return publicError(e, 403);
  }
}
