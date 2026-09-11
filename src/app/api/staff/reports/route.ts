import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson, publicError } from "@/lib/security";
import { shopToday, addDays, clock, parseDate } from "@/lib/booking-data";

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * The shop's numbers for a period: per chair, per day, the no-show and
 * rebooking rates, the busiest hours and the quietest days. Owners see every
 * chair; barbers see their own. With format=csv the owner gets every booking
 * in the period as a spreadsheet.
 */
export async function GET(req: Request) {
  try {
    const staff = await requireStaff();
    const db = createAdminClient();
    const params = new URL(req.url).searchParams;
    const csv = params.get("format") === "csv";
    const days = Math.min(
      csv ? 730 : 365,
      Math.max(7, Number(params.get("days")) || 30),
    );
    const from = addDays(shopToday(), -(days - 1));
    const to = shopToday();
    let query = db
      .from("bookings")
      .select(
        "id,status,price_pence,paid_by,barber_id,service_id,local_date,start_minute,duration,fee_pence,fee_status,source,barbers(name),services(name),booking_groups(customer_id,customers(name,email,phone))",
      )
      .gte("local_date", from)
      .lte("local_date", to)
      .order("local_date")
      .order("start_minute")
      .limit(20000);
    if (staff.role !== "owner") query = query.eq("barber_id", staff.barber_id);
    const { data, error } = await query;
    if (error) throw new Error("Reports could not load");
    type Row = (typeof data)[number] & {
      barbers: { name: string } | null;
      services: { name: string } | null;
      booking_groups: {
        customer_id: string | null;
        customers: { name: string; email: string; phone: string } | null;
      } | null;
    };
    const rows = data as unknown as Row[];

    if (csv) {
      if (staff.role !== "owner")
        throw new Error("Only the owner can download bookings");
      const lines = rows.map((r) =>
        [
          r.local_date,
          clock(r.start_minute),
          r.duration,
          r.booking_groups?.customers?.name ?? "Walk-in",
          r.booking_groups?.customers?.phone ?? "",
          r.booking_groups?.customers?.email ?? "",
          r.barbers?.name ?? "",
          r.services?.name ?? "",
          r.status,
          (r.price_pence / 100).toFixed(2),
          r.paid_by ?? "",
          r.fee_status === "charged" ? (r.fee_pence / 100).toFixed(2) : "",
          r.source,
        ]
          .map(csvCell)
          .join(","),
      );
      return new Response(
        [
          "Date,Time,Minutes,Client,Mobile,Email,Chair,Trim,Status,Price,Paid by,Fee charged,Booked via",
          ...lines,
        ].join("\r\n") + "\r\n",
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="symmetry-bookings-${from}-to-${to}.csv"`,
            "Cache-Control": "private, no-store",
          },
        },
      );
    }

    const { data: barbers } =
      staff.role === "owner"
        ? await db.from("barbers").select("id,name").order("display_order")
        : { data: null };
    const done = rows.filter((x) => x.status === "done");
    const noShows = rows.filter((x) => x.status === "no_show");
    const rate = (bad: number, good: number) =>
      bad + good ? Math.round((bad / (bad + good)) * 100) : null;
    const byBarber = barbers?.map((barber) => {
      const mine = rows.filter((x) => x.barber_id === barber.id);
      const completed = mine.filter((x) => x.status === "done").length;
      const missed = mine.filter((x) => x.status === "no_show").length;
      return {
        name: barber.name,
        trims: mine.length,
        completed,
        noShows: missed,
        noShowRate: rate(missed, completed),
        cancelled: mine.filter((x) => x.status === "cancelled").length,
        completedValue: mine
          .filter((x) => x.status === "done")
          .reduce((s, x) => s + x.price_pence, 0),
      };
    });

    // Rebooking: of everyone who had a trim in the period, how many came back for another.
    const visits = new Map<string, number>();
    for (const r of done) {
      const id = r.booking_groups?.customer_id;
      if (id) visits.set(id, (visits.get(id) ?? 0) + 1);
    }
    const clients = visits.size;
    const returning = [...visits.values()].filter((n) => n >= 2).length;

    // Busiest hours: every trim that happened or is booked, by the hour it starts.
    const live = rows.filter((x) =>
      ["done", "booked", "arrived"].includes(x.status),
    );
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      trims: live.filter((x) => Math.floor(x.start_minute / 60) === h).length,
    })).filter((h) => h.trims > 0);

    // Days of the week: trims per weekday, and how many of each weekday had any trim, for an average.
    const weekdayNames = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const weekdays = weekdayNames.map((name, i) => {
      const onDay = live.filter(
        (x) => (parseDate(x.local_date).getUTCDay() + 6) % 7 === i,
      );
      const openDays = new Set(onDay.map((x) => x.local_date)).size;
      return {
        name,
        trims: onDay.length,
        openDays,
        perDay: openDays ? Math.round((onDay.length / openDays) * 10) / 10 : 0,
      };
    });

    return privateJson({
      period: `Last ${days} days`,
      days,
      byBarber,
      trims: rows.length,
      completed: done.length,
      noShows: noShows.length,
      noShowRate: rate(noShows.length, done.length),
      cancelled: rows.filter((x) => x.status === "cancelled").length,
      completedValue: done.reduce((s, x) => s + x.price_pence, 0),
      fees: rows
        .filter((x) => x.fee_status === "charged")
        .reduce((s, x) => s + x.fee_pence, 0),
      rebooking: { clients, returning },
      hours,
      weekdays,
      dayCounts: Object.fromEntries(
        [...new Set(rows.map((x) => x.local_date))].map((day) => [
          day,
          rows.filter((x) => x.local_date === day).length,
        ]),
      ),
    });
  } catch (e) {
    return publicError(e, 403);
  }
}
