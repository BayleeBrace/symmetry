import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addDays, isOpen, OPENING_HOURS, parseDate, SERVICES, shopToday } from "@/lib/booking-data";
import { loadManagedBookingGroup } from "@/lib/manage-bookings";
import { createAdminClient, hasSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tokenSchema = z.string().min(20).max(200);
const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel"), token: tokenSchema, bookingId: z.uuid() }),
  z.object({
    action: z.literal("reschedule"),
    token: tokenSchema,
    bookingId: z.uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.number().int().min(0).max(1439),
  }),
]);

export async function GET(request: NextRequest) {
  const parsedToken = tokenSchema.safeParse(request.nextUrl.searchParams.get("token"));
  if (!parsedToken.success) return NextResponse.json({ error: "That management link isn’t valid." }, { status: 400 });
  if (!hasSupabase()) return NextResponse.json({ error: "Booking management will be available when live bookings are connected." }, { status: 503 });

  const group = await loadManagedBookingGroup(parsedToken.data);
  if (!group) return NextResponse.json({ error: "We couldn’t find bookings for that secure link." }, { status: 404 });

  return NextResponse.json(group, { headers: { "cache-control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "That change isn’t valid." }, { status: 400 });
  if (!hasSupabase()) return NextResponse.json({ error: "Booking management will be available when live bookings are connected." }, { status: 503 });

  const group = await loadManagedBookingGroup(parsed.data.token);
  const appointment = group?.appointments.find((item) => item.id === parsed.data.bookingId);
  if (!group || !appointment) return NextResponse.json({ error: "We couldn’t find that trim." }, { status: 404 });
  if (appointment.status !== "booked") return NextResponse.json({ error: "That trim can no longer be changed online." }, { status: 409 });

  const today = shopToday();
  if (appointment.date < today) return NextResponse.json({ error: "Past trims can’t be changed." }, { status: 409 });

  const supabase = createAdminClient();

  if (parsed.data.action === "cancel") {
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", appointment.id)
      .eq("group_id", group.id)
      .eq("status", "booked")
      .select("id")
      .maybeSingle();

    if (error || !data) return NextResponse.json({ error: "That trim couldn’t be cancelled. Please contact the shop." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  const detail = SERVICES.find((item) => item.id === appointment.service.slug)?.barbers[appointment.barber.slug];
  const hours = OPENING_HOURS[parseDate(parsed.data.date).getUTCDay()];
  const validDate = isOpen(parsed.data.date) && parsed.data.date >= today && parsed.data.date <= addDays(today, 120);
  const validTime = Boolean(hours && detail && parsed.data.time % 15 === 0 && parsed.data.time >= hours[0] && parsed.data.time + detail.duration <= hours[1]);
  if (!validDate || !validTime) return NextResponse.json({ error: "Choose another open date and time." }, { status: 400 });

  const { data, error } = await supabase
    .from("bookings")
    .update({ local_date: parsed.data.date, start_minute: parsed.data.time, updated_at: new Date().toISOString() })
    .eq("id", appointment.id)
    .eq("group_id", group.id)
    .eq("status", "booked")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const conflict = error?.code === "23P01";
    return NextResponse.json({ error: conflict ? "That time has just been taken. Choose another." : "That trim couldn’t be moved." }, { status: conflict ? 409 : 503 });
  }

  return NextResponse.json({ ok: true });
}
