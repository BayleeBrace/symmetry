import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient, hasSupabase } from "@/lib/supabase/admin";
import type { BarberId } from "@/lib/booking-data";

export type ManagedAppointment = {
  id: string;
  date: string;
  time: number;
  duration: number;
  pricePence: number;
  status: "booked" | "arrived" | "done" | "no_show" | "cancelled";
  barber: { id: string; slug: BarberId; name: string };
  service: { id: string; slug: string; name: string };
};

export type ManagedBookingGroup = {
  id: string;
  customer: { name: string; email: string };
  appointments: ManagedAppointment[];
};

export function hashManageToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function loadManagedBookingGroup(token: string): Promise<ManagedBookingGroup | null> {
  if (!hasSupabase()) return null;

  const supabase = createAdminClient();
  const { data: group, error: groupError } = await supabase
    .from("booking_groups")
    .select("id,customer_id")
    .eq("manage_token_hash", hashManageToken(token))
    .maybeSingle();

  if (groupError || !group) return null;

  const [customerResult, bookingResult] = await Promise.all([
    supabase.from("customers").select("name,email").eq("id", group.customer_id).single(),
    supabase
      .from("bookings")
      .select("id,barber_id,service_id,local_date,start_minute,duration,price_pence,status")
      .eq("group_id", group.id)
      .order("local_date")
      .order("start_minute"),
  ]);

  if (customerResult.error || bookingResult.error || !customerResult.data) return null;

  if (!bookingResult.data.length) {
    return { id: group.id, customer: customerResult.data, appointments: [] };
  }

  const barberIds = [...new Set(bookingResult.data.map((item) => item.barber_id))];
  const serviceIds = [...new Set(bookingResult.data.map((item) => item.service_id))];
  const [barberResult, serviceResult] = await Promise.all([
    supabase.from("barbers").select("id,slug,name").in("id", barberIds),
    supabase.from("services").select("id,slug,name").in("id", serviceIds),
  ]);

  if (barberResult.error || serviceResult.error) return null;

  const barbers = new Map(barberResult.data.map((item) => [item.id, item]));
  const services = new Map(serviceResult.data.map((item) => [item.id, item]));
  const appointments = bookingResult.data.flatMap((item) => {
    const barber = barbers.get(item.barber_id);
    const service = services.get(item.service_id);
    if (!barber || !service) return [];

    return [{
      id: item.id,
      date: item.local_date,
      time: item.start_minute,
      duration: item.duration,
      pricePence: item.price_pence,
      status: item.status,
      barber: { id: barber.id, slug: barber.slug as BarberId, name: barber.name },
      service: { id: service.id, slug: service.slug, name: service.name },
    } satisfies ManagedAppointment];
  });

  return {
    id: group.id,
    customer: customerResult.data,
    appointments,
  };
}
