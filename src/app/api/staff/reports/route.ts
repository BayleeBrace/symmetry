import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { privateJson, publicError } from "@/lib/security";
import { shopToday, addDays } from "@/lib/booking-data";
export async function GET() {
  try {
    const staff = await requireStaff();
    const db = createAdminClient();
    let query = db
      .from("bookings")
      .select(
        "status,price_pence,barber_id,service_id,local_date,fee_pence,fee_status",
      )
      .gte("local_date", addDays(shopToday(), -30))
      .lte("local_date", shopToday());
    if (staff.role !== "owner") query = query.eq("barber_id", staff.barber_id);
    const { data, error } = await query;
    if (error) throw new Error("Reports could not load");
    const { data: barbers } =
      staff.role === "owner"
        ? await db.from("barbers").select("id,name").order("display_order")
        : { data: null };
    const byBarber = barbers?.map((barber) => {
      const rows = data.filter((x) => x.barber_id === barber.id);
      return {
        name: barber.name,
        trims: rows.length,
        completed: rows.filter((x) => x.status === "done").length,
        noShows: rows.filter((x) => x.status === "no_show").length,
        cancelled: rows.filter((x) => x.status === "cancelled").length,
        completedValue: rows
          .filter((x) => x.status === "done")
          .reduce((s, x) => s + x.price_pence, 0),
      };
    });
    return privateJson({
      period: "Last 30 days",
      byBarber,
      trims: data.length,
      completed: data.filter((x) => x.status === "done").length,
      noShows: data.filter((x) => x.status === "no_show").length,
      cancelled: data.filter((x) => x.status === "cancelled").length,
      completedValue: data
        .filter((x) => x.status === "done")
        .reduce((s, x) => s + x.price_pence, 0),
      fees: data
        .filter((x) => x.fee_status === "charged")
        .reduce((s, x) => s + x.fee_pence, 0),
      days: Object.fromEntries(
        [...new Set(data.map((x) => x.local_date))].map((day) => [
          day,
          data.filter((x) => x.local_date === day).length,
        ]),
      ),
    });
  } catch (e) {
    return publicError(e, 403);
  }
}
