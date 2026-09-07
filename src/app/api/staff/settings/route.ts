import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("policy"),
    cancellation_hours: z.number().int().min(0).max(168),
    late_percent: z.number().int().min(0).max(100),
    no_show_percent: z.number().int().min(0).max(100),
    policy_confirmed: z.boolean(),
  }),
  z.object({
    action: z.literal("schedule"),
    barber_id: z.uuid(),
    iso_weekday: z.number().int().min(1).max(7),
    open_minute: z.number().int().min(0).max(1439).nullable(),
    close_minute: z.number().int().min(1).max(1440).nullable(),
  }),
  z.object({
    action: z.literal("price"),
    barber_id: z.uuid(),
    service_id: z.uuid(),
    price_pence: z.number().int().min(0).max(100000),
    duration: z.number().int().min(5).max(480),
  }),
]);
export async function GET() {
  try {
    await requireStaff();
    const db = createAdminClient();
    const [p, s] = await Promise.all([
      db.from("shop_settings").select("*").single(),
      db.from("barber_schedules").select("*"),
    ]);
    if (p.error || s.error) throw new Error("Settings could not load");
    return privateJson({ policy: p.data, schedules: s.data });
  } catch (e) {
    return publicError(e, 403);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await requireStaff(true);
    const p = schema.parse(await req.json());
    const db = createAdminClient();
    const { action, ...values } = p;
    if (action === "schedule") {
      const v = values as {
        barber_id: string;
        iso_weekday: number;
        open_minute: number | null;
        close_minute: number | null;
      };
      const { data: bookings } = await db
        .from("bookings")
        .select("id")
        .eq("barber_id", v.barber_id)
        .in("status", ["booked", "arrived"])
        .gte("local_date", new Date().toISOString().slice(0, 10))
        .limit(1);
      if (bookings?.length)
        throw new Error(
          "Contact the owner to reconcile existing bookings before changing weekly hours. Use dated blocks for holidays.",
        );
    }
    const { error } =
      action === "policy"
        ? await db
            .from("shop_settings")
            .update({ ...values, version: new Date().toISOString() })
            .eq("id", true)
        : await db
            .from(action === "schedule" ? "barber_schedules" : "service_prices")
            .upsert(values as Record<string, unknown>);
    if (error) throw new Error("Settings could not be saved");
    return privateJson({ ok: true });
  } catch (e) {
    return publicError(e);
  }
}
