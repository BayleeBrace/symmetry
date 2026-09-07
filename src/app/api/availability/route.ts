import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BARBERS, BarberId, BusyPeriod, isOpen, OPENING_HOURS, parseDate } from "@/lib/booking-data";
import { createAdminClient, hasSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isOpen),
  barber: z.enum(["sean", "travis", "dylan", "any"]),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Choose an open date and barber." }, { status: 400 });
  const { date, barber } = parsed.data;
  const barbers = barber === "any" ? Object.keys(BARBERS) as BarberId[] : [barber];

  if (!hasSupabase()) {
    const hours = OPENING_HOURS[parseDate(date).getUTCDay()]!;
    const offset: Record<BarberId, number> = { sean: 0, travis: 30, dylan: 60 };
    const busy: BusyPeriod[] = barbers.flatMap((barberId) => [
      { barber: barberId, start: hours[0] + 90 + offset[barberId], duration: 45 },
      { barber: barberId, start: 780, duration: 30 },
    ]);
    return NextResponse.json({ mode: "preview", busy });
  }

  const supabase = createAdminClient();
  const { data: barberRows, error: barberError } = await supabase.from("barbers").select("id,slug").in("slug", barbers);
  if (barberError) return NextResponse.json({ error: "Availability couldn’t load." }, { status: 503 });
  const ids = barberRows.map((item) => item.id);
  const slugById = new Map(barberRows.map((item) => [item.id, item.slug as BarberId]));
  const [bookingResult, blockResult] = await Promise.all([
    supabase.from("bookings").select("barber_id,start_minute,duration").eq("local_date", date).in("barber_id", ids).in("status", ["booked", "arrived"]),
    supabase.from("diary_blocks").select("barber_id,start_minute,duration").eq("local_date", date).in("barber_id", ids),
  ]);
  if (bookingResult.error || blockResult.error) return NextResponse.json({ error: "Availability couldn’t load." }, { status: 503 });
  const busy = [...bookingResult.data, ...blockResult.data].map((item) => ({ barber: slugById.get(item.barber_id)!, start: item.start_minute, duration: item.duration }));
  return NextResponse.json({ mode: "live", busy }, { headers: { "cache-control": "no-store" } });
}
