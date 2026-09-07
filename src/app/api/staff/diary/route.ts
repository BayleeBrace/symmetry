import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validDate,
  shopToday,
  shopMinute,
  parseDate,
} from "@/lib/booking-data";
import { getCatalog } from "@/lib/catalog";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
const actions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    id: z.uuid(),
    status: z.enum(["arrived", "done", "no_show", "cancelled"]),
    version: z.string(),
  }),
  z.object({
    action: z.literal("move"),
    id: z.uuid(),
    date: z.string().refine(validDate),
    time: z.number().int().min(0).max(1439),
    version: z.string(),
  }),
  z.object({
    action: z.literal("block"),
    barber: z.uuid(),
    date: z.string().refine(validDate),
    time: z.number().int().min(0).max(1439),
    duration: z.number().int().min(5).max(1440),
    label: z.string().min(1).max(80),
  }),
  z.object({ action: z.literal("unblock"), id: z.uuid() }),
  z.object({
    action: z.literal("walkin"),
    barber: z.string(),
    service: z.string(),
    date: z.string().refine(validDate),
    time: z.number().int(),
    name: z.string().min(2).max(100),
    email: z.email().or(z.literal("")),
    phone: z.string().max(30),
  }),
]);
export async function GET(req: Request) {
  try {
    const staff = await requireStaff();
    const db = createAdminClient();
    const date = new URL(req.url).searchParams.get("date") || shopToday();
    if (!validDate(date)) throw new Error("Choose a date");
    let q = db
      .from("bookings")
      .select(
        "*,barbers(name,slug),services(name),booking_groups(customer_id,customers(name,email,phone,preferences),policy_snapshot)",
      )
      .eq("local_date", date)
      .order("start_minute");
    let blocks = db.from("diary_blocks").select("*").eq("local_date", date);
    if (staff.role !== "owner") {
      q = q.eq("barber_id", staff.barber_id);
      blocks = blocks.eq("barber_id", staff.barber_id);
    }
    const [rows, br, bl, sv, pr, catalog] = await Promise.all([
      q,
      db.from("barbers").select("*"),
      blocks,
      db.from("services").select("*").eq("active", true),
      db.from("service_prices").select("*"),
      getCatalog(),
    ]);
    if (rows.error || br.error || bl.error || sv.error || pr.error)
      throw new Error("The diary could not load");
    const ids = rows.data.map((b) => b.id);
    const { data: events } = await db
      .from("booking_events")
      .select("id,booking_id,kind,created_at")
      .in("booking_id", ids)
      .order("created_at", { ascending: false })
      .limit(30);
    return privateJson({
      staff,
      date,
      hours: catalog.hours[parseDate(date).getUTCDay()] ?? null,
      bookings: rows.data,
      barbers: br.data,
      blocks: bl.data,
      services: sv.data,
      prices: pr.data,
      events: events || [],
    });
  } catch (e) {
    return publicError(e, 403);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff();
    const p = actions.parse(await req.json());
    const db = createAdminClient();
    if (p.action === "walkin") {
      const { data: b } = await db
        .from("barbers")
        .select("id")
        .eq("slug", p.barber)
        .single();
      if (!b || (staff.role !== "owner" && staff.barber_id !== b.id))
        throw new Error("Choose your own chair");
      const token = createHash("sha256").update(randomBytes(32)).digest("hex");
      const { data: g, error } = await db.rpc("create_booking_group", {
        p_customer_name: p.name,
        p_email: p.email,
        p_phone_country: "GB",
        p_phone: p.phone,
        p_marketing: false,
        p_manage_token_hash: token,
        p_appointments: [
          { barber: p.barber, service: p.service, date: p.date, time: p.time },
        ],
      });
      if (error)
        throw new Error(
          "That slot is unavailable. Check working hours and existing bookings.",
        );
      await db.from("bookings").update({ source: "walk_in" }).eq("group_id", g);
      return privateJson({ ok: true });
    }
    if (p.action === "block") {
      if (staff.role !== "owner" && staff.barber_id !== p.barber)
        throw new Error("Choose your own chair");
      const { error } = await db.from("diary_blocks").insert({
        barber_id: p.barber,
        local_date: p.date,
        start_minute: p.time,
        duration: p.duration,
        label: p.label,
      });
      if (error)
        throw new Error("That block overlaps a booking or another block");
      return privateJson({ ok: true });
    }
    if (p.action === "unblock") {
      let q = db.from("diary_blocks").delete().eq("id", p.id);
      if (staff.role !== "owner") q = q.eq("barber_id", staff.barber_id);
      const { error } = await q;
      if (error) throw new Error("Block could not be removed");
      return privateJson({ ok: true });
    }
    const { data: b } = await db
      .from("bookings")
      .select("*,booking_groups(policy_snapshot)")
      .eq("id", p.id)
      .single();
    if (!b || (staff.role !== "owner" && staff.barber_id !== b.barber_id))
      throw new Error("This trim is not in your diary");
    if (!["booked", "arrived"].includes(b.status))
      throw new Error("This trim is already closed");
    let update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (p.action === "move") {
      update = { ...update, local_date: p.date, start_minute: p.time };
    } else {
      if (
        ["done", "no_show"].includes(p.status) &&
        (b.local_date > shopToday() ||
          (b.local_date === shopToday() && b.start_minute > shopMinute()))
      )
        throw new Error("This trim has not started yet");
      update.status = p.status;
      if (p.status === "no_show") {
        const percent = b.booking_groups?.policy_snapshot?.no_show_percent || 0;
        update.fee_pence = Math.round((b.price_pence * percent) / 100);
        update.fee_status = percent ? "review" : "none";
      }
    }
    const { data, error } = await db
      .from("bookings")
      .update(update)
      .eq("id", b.id)
      .eq("updated_at", p.version)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error(
        "The diary changed or that time is unavailable. Refresh and try again.",
      );
    await db.from("booking_events").insert({
      booking_id: b.id,
      group_id: b.group_id,
      kind: "staff_action",
      actor: staff.user_id,
      detail: { action: p.action },
    });
    return privateJson({ ok: true });
  } catch (e) {
    return publicError(e, 409);
  }
}
