import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addDays, isOpen, SERVICES, shopToday } from "@/lib/booking-data";
import { createAdminClient, hasSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const appointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  barber: z.enum(["sean", "travis", "dylan"]),
  service: z.string().max(40),
  time: z.number().int().min(0).max(1439),
}).strip();

const requestSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email().max(254),
    country: z.string().regex(/^[A-Z]{2}$/),
    phone: z.string().trim().min(7).max(30).refine((value) => /^[0-9 ()+.-]+$/.test(value)),
    marketing: z.boolean(),
  }),
  appointments: z.array(appointmentSchema).min(1).max(12),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check your details and every trim, then try again." }, { status: 400 });

  const today = shopToday();
  let normalised;
  try {
    normalised = parsed.data.appointments.map((appointment) => {
      const service = SERVICES.find((item) => item.id === appointment.service);
      const detail = service?.barbers[appointment.barber];
      if (!service || !detail || !isOpen(appointment.date) || appointment.date < today || appointment.date > addDays(today, 120) || appointment.time % 15) throw new Error();
      return { ...appointment, duration: detail.duration, pricePence: Math.round(detail.price * 100) };
    });
  } catch {
    return NextResponse.json({ error: "One of those trims isn’t valid anymore." }, { status: 400 });
  }
  for (let index = 0; index < normalised.length; index++) for (let other = index + 1; other < normalised.length; other++) {
    const a = normalised[index], b = normalised[other];
    if (a.date === b.date && a.time < b.time + b.duration && a.time + a.duration > b.time) return NextResponse.json({ error: "Two of your trims overlap. Change one before continuing." }, { status: 400 });
  }

  if (!hasSupabase()) {
    return NextResponse.json({ mode: "preview", reference: `PREVIEW-${randomBytes(3).toString("hex").toUpperCase()}` });
  }

  const manageToken = randomBytes(32).toString("base64url");
  const manageTokenHash = createHash("sha256").update(manageToken).digest("hex");
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("create_booking_group", {
    p_customer_name: parsed.data.customer.name,
    p_email: parsed.data.customer.email.toLowerCase(),
    p_phone_country: parsed.data.customer.country,
    p_phone: parsed.data.customer.phone,
    p_marketing: parsed.data.customer.marketing,
    p_manage_token_hash: manageTokenHash,
    p_appointments: normalised,
  });
  if (error) {
    const conflict = error.code === "23P01" || error.message.includes("not available");
    return NextResponse.json({ error: conflict ? "One of those times has just been taken. Choose another." : "We couldn’t complete your booking. Please try again." }, { status: conflict ? 409 : 503 });
  }
  return NextResponse.json({ mode: "live", reference: data, manageToken, manageUrl: `/bookings?token=${encodeURIComponent(manageToken)}` }, { status: 201 });
}
