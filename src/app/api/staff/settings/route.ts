import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";
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
    active: z.boolean().optional(),
  }),
  // The catalogue: services the website and the diary offer.
  z.object({
    action: z.literal("service_add"),
    name: z.string().trim().min(2).max(60),
    price_pence: z.number().int().min(0).max(100000),
    duration: z.number().int().min(5).max(480),
  }),
  z.object({
    action: z.literal("service_rename"),
    id: z.uuid(),
    name: z.string().trim().min(2).max(60),
  }),
  z.object({
    action: z.literal("service_active"),
    id: z.uuid(),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("service_move"),
    id: z.uuid(),
    direction: z.union([z.literal(-1), z.literal(1)]),
  }),
  z.object({ action: z.literal("service_delete"), id: z.uuid() }),
]);

export async function GET() {
  try {
    const staff = await requireStaff();
    const db = createAdminClient();
    const [p, s, services, prices] = await Promise.all([
      db.from("shop_settings").select("*").single(),
      db.from("barber_schedules").select("*"),
      // Every service, hidden ones included, for the owner's catalogue.
      staff.role === "owner"
        ? db.from("services").select("*").order("display_order").order("name")
        : Promise.resolve({ data: [], error: null }),
      staff.role === "owner"
        ? db.from("service_prices").select("*")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (p.error || s.error || services.error || prices.error)
      throw new Error("Settings could not load");
    return privateJson({
      policy: p.data,
      schedules: s.data,
      services: services.data,
      prices: prices.data,
    });
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

    if (p.action === "service_add") {
      const base = slugify(p.name);
      const { data: taken } = await db
        .from("services")
        .select("slug,display_order")
        .order("display_order", { ascending: false });
      const slugs = new Set((taken || []).map((t) => t.slug));
      let slug = base;
      for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
      const order = ((taken || [])[0]?.display_order ?? 0) + 1;
      const { data: made, error } = await db
        .from("services")
        .insert({ name: p.name, slug, active: true, display_order: order })
        .select("id")
        .single();
      if (error || !made) throw new Error("The service could not be added");
      // Every working chair offers it at the starting price; change per chair after.
      const { data: chairs } = await db
        .from("barbers")
        .select("id")
        .eq("active", true);
      if (chairs?.length)
        await db.from("service_prices").insert(
          chairs.map((c) => ({
            barber_id: c.id,
            service_id: made.id,
            price_pence: p.price_pence,
            duration: p.duration,
            active: true,
          })),
        );
      return privateJson({ ok: true, id: made.id });
    }
    if (p.action === "service_rename") {
      const { error } = await db
        .from("services")
        .update({ name: p.name })
        .eq("id", p.id);
      if (error) throw new Error("The service could not be renamed");
      return privateJson({ ok: true });
    }
    if (p.action === "service_active") {
      const { error } = await db
        .from("services")
        .update({ active: p.active })
        .eq("id", p.id);
      if (error) throw new Error("The service could not be changed");
      return privateJson({ ok: true });
    }
    if (p.action === "service_move") {
      const { data: all } = await db
        .from("services")
        .select("id,display_order")
        .order("display_order")
        .order("name");
      const list = all || [];
      const i = list.findIndex((s) => s.id === p.id);
      const j = i + p.direction;
      if (i < 0 || j < 0 || j >= list.length) return privateJson({ ok: true });
      // Renumber the whole list so the swap is unambiguous.
      [list[i], list[j]] = [list[j], list[i]];
      await Promise.all(
        list.map((s, n) =>
          db
            .from("services")
            .update({ display_order: n + 1 })
            .eq("id", s.id),
        ),
      );
      return privateJson({ ok: true });
    }
    if (p.action === "service_delete") {
      const { count } = await db
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("service_id", p.id);
      if (count)
        throw new Error(
          `This service is on ${count} booking${count === 1 ? "" : "s"}, so it cannot be deleted. Hide it instead and it disappears from the website and the diary.`,
        );
      const { error } = await db.from("services").delete().eq("id", p.id);
      if (error) throw new Error("The service could not be deleted");
      return privateJson({ ok: true });
    }

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
