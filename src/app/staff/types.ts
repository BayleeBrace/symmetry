import { addDays, clock, money, parseDate, SERVICES } from "@/lib/booking-data";

export type BookingStatus =
  "booked" | "arrived" | "done" | "no_show" | "cancelled";

export type PaidBy = "card" | "cash" | "other";

export type Barber = {
  id: string;
  name: string;
  slug: string;
  active?: boolean;
  display_order?: number;
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
  paid_by?: PaidBy | null;
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

/** What the sheet shows about a customer: past visits, no shows, last trim. */
export type CustomerHistory = {
  visits: number;
  noShows: number;
  last: { date: string; barber_id: string; service_id: string } | null;
};

export type Shift = {
  barber_id: string;
  iso_weekday: number;
  open_minute: number | null;
  close_minute: number | null;
};

export type Diary = {
  staff: { user_id: string; role: "owner" | "barber"; barber_id: string };
  shifts?: Shift[];
  bookings: Booking[];
  barbers: Barber[];
  services: Service[];
  prices: Price[];
  blocks: Block[];
  events: { id: string; kind: string; created_at: string }[];
  hours: [number, number] | null;
  date: string;
  to?: string;
  hoursByDay?: Record<string, [number, number] | null>;
  history?: Record<string, CustomerHistory>;
};

/** The part of the diary every section needs: who is signed in, the chairs, the menu. */
export type Context = Pick<Diary, "staff" | "barbers" | "services" | "prices">;

export type Act = (url: string, data: unknown) => Promise<unknown>;

export const STATUS_LABEL: Record<BookingStatus, string> = {
  booked: "Booked",
  arrived: "In the chair",
  done: "Done",
  no_show: "No show",
  cancelled: "Cancelled",
};

export const PAID_LABEL: Record<PaidBy, string> = {
  card: "Card",
  cash: "Cash",
  other: "Other",
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

export function dayNumber(date: string) {
  return parseDate(date).getUTCDate();
}

export function weekdayShort(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(parseDate(date));
}

export function monthLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDate(date));
}

/** Monday of the week the date falls in. */
export function weekStart(date: string) {
  const dow = (parseDate(date).getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

export function weekDays(date: string) {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekLabel(date: string) {
  const days = weekDays(date);
  const first = parseDate(days[0]);
  const last = parseDate(days[6]);
  const month = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
      d,
    );
  return first.getUTCMonth() === last.getUTCMonth()
    ? `${first.getUTCDate()} to ${last.getUTCDate()} ${month(last)}`
    : `${first.getUTCDate()} ${month(first)} to ${last.getUTCDate()} ${month(last)}`;
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

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** Which chair is which colour in the calendar: first, second, third chair. */
export function chairIndex(barbers: Barber[], id: string) {
  const i = barbers.findIndex((b) => b.id === id);
  return i < 0 ? 0 : i % 3;
}

export function isoWeekday(date: string) {
  return ((parseDate(date).getUTCDay() + 6) % 7) + 1;
}

/** The colour a service gets in the calendar: stable by its position in the menu. */
export function serviceTint(diary: Diary, serviceId: string) {
  const ordered = [...diary.services].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const i = ordered.findIndex((s) => s.id === serviceId);
  return i < 0 ? 0 : i % 7;
}

/**
 * When a chair is working on a date: the shop's hours, narrowed by the
 * barber's own shift if one is set, the same way the diary trigger decides.
 */
export function chairHours(
  diary: Diary,
  date: string,
  barberId: string,
): [number, number] | null {
  const shop = hoursFor(diary, date);
  if (!shop) return null;
  const shift = diary.shifts?.find(
    (s) => s.barber_id === barberId && s.iso_weekday === isoWeekday(date),
  );
  if (!shift) return shop;
  if (shift.open_minute === null || shift.close_minute === null) return null;
  const hours: [number, number] = [
    Math.max(shop[0], shift.open_minute),
    Math.min(shop[1], shift.close_minute),
  ];
  return hours[0] < hours[1] ? hours : null;
}

export function hoursFor(diary: Diary, date: string) {
  return diary.hoursByDay && date in diary.hoursByDay
    ? diary.hoursByDay[date]
    : diary.date === date
      ? diary.hours
      : null;
}

/**
 * Start times a trim of the given length fits into on one chair on one day:
 * inside the hours, around every other open trim and every break.
 */
export function freeTimes(
  diary: Diary,
  date: string,
  barberId: string,
  duration: number,
  exceptId?: string,
) {
  const hours = chairHours(diary, date, barberId);
  const onDay = <T extends { local_date?: string }>(x: T) =>
    !x.local_date || x.local_date === date;
  const dayOff = diary.blocks.some(
    (b) => onDay(b) && b.barber_id === barberId && b.duration >= 1440,
  );
  const taken = [
    ...diary.bookings.filter(
      (b) =>
        onDay(b) &&
        b.barber_id === barberId &&
        b.id !== exceptId &&
        OPEN_STATUSES.includes(b.status),
    ),
    ...diary.blocks.filter(
      (b) => onDay(b) && b.barber_id === barberId && b.duration < 1440,
    ),
  ].map((b) => [b.start_minute, b.start_minute + b.duration]);
  const free: number[] = [];
  if (hours && !dayOff)
    for (let m = hours[0]; m + duration <= hours[1]; m += 15)
      if (!taken.some(([s, e]) => m < e && m + duration > s)) free.push(m);
  return { free, closed: !hours || dayOff };
}
