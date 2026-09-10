import { z } from "zod";
import { after } from "next/server";
import { loadManagedBookingGroup } from "@/lib/manage-bookings";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCatalog } from "@/lib/catalog";
import { notifyTrim } from "@/lib/staff-push";
import {
  sameOrigin,
  rateLimit,
  privateJson,
  publicError,
} from "@/lib/security";
import { validDate, shopToday } from "@/lib/booking-data";
const schema = z.object({
  token: z.string().min(20).max(2000),
  bookingId: z.uuid().optional(),
  action: z.enum(["cancel", "reschedule", "preferences", "late"]),
  date: z.string().refine(validDate).optional(),
  time: z.number().int().min(0).max(1439).optional(),
  barber: z.enum(["sean", "travis", "dylan"]).optional(),
  service: z.string().max(40).optional(),
  acceptFee: z.boolean().optional(),
  preferences: z.string().max(1000).optional(),
  minutes: z.number().int().min(5).max(60).optional(),
});
export async function GET(req: Request) {
  try {
    await rateLimit(req, "manage-read", 120);
    const token = new URL(req.url).searchParams.get("token") || "";
    const group = await loadManagedBookingGroup(token);
    if (!group)
      return privateJson(
        { error: "This link is invalid or has expired. Request a fresh link." },
        404,
      );
    return privateJson({ ...group, catalog: await getCatalog() });
  } catch (e) {
    return publicError(e, 503);
  }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    await rateLimit(req, "manage-change", 30);
    const p = schema.parse(await req.json());
    const group = await loadManagedBookingGroup(p.token);
    if (!group)
      return privateJson({ error: "Your link is invalid or expired" }, 404);
    const db = createAdminClient();
    if (p.action === "preferences") {
      const { data: g } = await db
        .from("booking_groups")
        .select("customer_id")
        .eq("id", group.id)
        .single();
      const { error } = await db
        .from("customers")
        .update({ preferences: p.preferences || "" })
        .eq("id", g!.customer_id);
      if (error) throw new Error("Notes could not be saved");
      return privateJson({ ok: true });
    }
    const b = group.appointments.find((x) => x.id === p.bookingId);
    if (!b) throw new Error("Trim not found");
    if (p.action === "late") {
      if (b.date !== shopToday() || b.status !== "booked")
        throw new Error("Use this for today’s upcoming trim");
      const { error } = await db
        .from("bookings")
        .update({
          late_minutes: p.minutes || 10,
          updated_at: new Date().toISOString(),
        })
        .eq("id", b.id)
        .eq("group_id", group.id);
      if (error) throw new Error("Could not let the shop know");
      await db.from("notification_jobs").upsert(
        {
          dedupe_key: `late-${b.id}-${p.minutes || 10}`,
          group_id: group.id,
          booking_id: b.id,
          kind: "running_late",
          channel: "push",
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      );
      const minutes = p.minutes || 10;
      after(() =>
        notifyTrim("running_late", b.id, {
          title: "Running late",
          lead: `Expects to be about ${minutes} minutes late.`,
        }),
      );
      return privateJson({ ok: true });
    }
    if (
      p.action === "reschedule" &&
      (!p.date || p.time === undefined || !p.barber || !p.service)
    )
      throw new Error("Choose a barber, trim, date and time");
    const { data, error } = await db.rpc("change_customer_booking", {
      p_group: group.id,
      p_booking: b.id,
      p_action: p.action,
      p_date: p.date,
      p_time: p.time,
      p_barber: p.barber,
      p_service: p.service,
      p_accept_fee: p.acceptFee || false,
    });
    if (error)
      throw new Error(
        error.code === "23P01"
          ? "That time has been taken. Please choose another."
          : error.message.includes("cancellation window")
            ? "Contact the shop to move a trim within the cancellation window."
            : error.message.includes("accept")
              ? "Please accept the late cancellation fee."
              : "The trim could not be changed. Check the date, time and cancellation policy.",
      );
    after(() =>
      p.action === "cancel"
        ? notifyTrim("cancelled", b.id, {
            title: "Cancelled online",
            lead: "A customer cancelled:",
          })
        : notifyTrim("moved", b.id, {
            title: "Moved online",
            lead: "A customer moved a trim. Now:",
          }),
    );
    return privateJson(data);
  } catch (e) {
    return publicError(e, 409);
  }
}
