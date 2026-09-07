import { clock, money, parseDate, SERVICES } from "@/lib/booking-data";

export type BookingStatus =
  "booked" | "arrived" | "done" | "no_show" | "cancelled";

export type Barber = {
  id: string;
  name: string;
  slug: string;
  active?: boolean;
};

export type Customer = {
  name: string;
  email: string | null;
  phone: string | null;
  preferences: string | null;
};

export type Booking = {
  id: string;
  group_id: string;
  barber_id: string;
  service_id: string;
  local_date: string;
  start_minute: number;
  duration: number;
  status: BookingStatus;
  price_pence: number;
  fee_pence: number;
  fee_status: string;
  updated_at: string;
  late_minutes: number;
  source?: string;
  barbers: { name: string; slug: string } | null;
  services: { name: string } | null;
  booking_groups: {
    customer_id?: string;
    customers: Customer | null;
  } | null;
};

export type Block = {
  id: string;
  barber_id: string;
  local_date?: string;
  start_minute: number;
  duration: number;
  label: string;
};

export type Service = {
  id: string;
  slug: string;
  name: string;
  display_order?: number;
};

export type Price = {
  barber_id: string;
  service_id: string;
  price_pence: number;
  duration: number;
  active?: boolean;
};

export type Diary = {
  staff: { user_id: string; role: "owner" | "barber"; barber_id: string };
  bookings: Booking[];
  barbers: Barber[];
  services: Service[];
  prices: Price[];
  blocks: Block[];
  events: { id: string; kind: string; created_at: string }[];
  hours: [number, number] | null;
  date: string;
};

export type Act = (url: string, data: unknown) => Promise<void>;

export const STATUS_LABEL: Record<BookingStatus, string> = {
  booked: "Booked",
  arrived: "In the chair",
  done: "Done",
  no_show: "No show",
  cancelled: "Cancelled",
};

export const OPEN_STATUSES: BookingStatus[] = ["booked", "arrived"];

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function timeRange(start: number, duration: number) {
  return `${clock(start)} to ${clock(start + duration)}`;
}

export function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(parseDate(date));
}

export function shortDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parseDate(date));
}

export function pounds(pence: number) {
  return money(pence / 100);
}

export function timeOptions(from: number, to: number, step = 15) {
  const out: number[] = [];
  for (let m = from; m <= to; m += step) out.push(m);
  return out;
}

/** Canonical service name from the code list, so the diary reads the same as the website even before the naming migration runs. */
export function canonicalServiceName(
  slug: string | undefined,
  fallback: string,
) {
  return SERVICES.find((s) => s.id === slug)?.name ?? fallback;
}

export function customerOf(booking: Booking): Customer {
  return (
    booking.booking_groups?.customers ?? {
      name: "Walk-in",
      email: null,
      phone: null,
      preferences: null,
    }
  );
}
