export const BARBERS = {
  sean: { name: "Sean", role: "Owner, barber" },
  travis: { name: "Travis", role: "Senior barber" },
  dylan: { name: "Dylan", role: "Junior barber" },
} as const;

export type BarberId = keyof typeof BARBERS;
export type BarberChoice = BarberId | "any";

type BarberPrice = Record<BarberId, { price: number; duration: number }>;
export type Service = { id: string; name: string; barbers: BarberPrice };

const prices = (
  dylan: [number, number],
  travis: [number, number],
  sean: [number, number],
): BarberPrice => ({
  dylan: { price: dylan[0], duration: dylan[1] },
  travis: { price: travis[0], duration: travis[1] },
  sean: { price: sean[0], duration: sean[1] },
});

export const SERVICES: Service[] = [
  {
    id: "fade",
    name: "Fade",
    barbers: prices([17, 50], [22, 45], [24, 40]),
  },
  {
    id: "fade-beard",
    name: "Fade and beard",
    barbers: prices([20, 60], [25, 50], [27, 45]),
  },
  {
    id: "cut",
    name: "Cut",
    barbers: prices([14, 35], [17, 30], [18, 30]),
  },
  {
    id: "cut-beard",
    name: "Cut and beard",
    barbers: prices([17, 45], [20, 35], [21, 30]),
  },
  {
    id: "under-16",
    name: "Under sixteens",
    barbers: prices([15, 45], [18, 40], [18.5, 35]),
  },
  {
    id: "under-13",
    name: "Under thirteens",
    barbers: prices([10, 40], [15, 30], [15.5, 25]),
  },
  {
    id: "over-60",
    name: "Over sixties",
    barbers: prices([10, 40], [12, 25], [12, 25]),
  },
  {
    id: "one-length",
    name: "One length",
    barbers: prices([10, 20], [12, 15], [12, 15]),
  },
  {
    id: "line-beard",
    name: "Line up and beard",
    barbers: prices([8, 20], [10, 15], [10, 15]),
  },
];

export const OPENING_HOURS: Record<number, [number, number] | null> = {
  0: null,
  1: null,
  2: [540, 1080],
  3: [660, 1140],
  4: [660, 1140],
  5: [540, 1080],
  6: [480, 900],
};

export const money = (value: number) =>
  value % 1 ? value.toFixed(2) : String(value);
export const inputTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const clock = (minutes: number) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
export const hourWord = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${h < 12 ? "am" : "pm"}`;
};

export function parseDate(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

export function shopToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function fullDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDate(value));
}

export function isOpen(value: string) {
  return (
    validDate(value) && Boolean(OPENING_HOURS[parseDate(value).getUTCDay()])
  );
}

export type Slot = {
  barber: BarberId;
  time: number;
  duration: number;
  price: number;
};
export type BusyPeriod = { barber: BarberId; start: number; duration: number };

export function makeSlots(
  date: string,
  barber: BarberChoice,
  serviceId: string,
  busy: BusyPeriod[],
  catalog = { services: SERVICES, hours: OPENING_HOURS },
) {
  const hours = catalog.hours[parseDate(date).getUTCDay()];
  const service = catalog.services.find((item) => item.id === serviceId);
  if (!hours || !service) return [];
  const barbers =
    barber === "any" ? (Object.keys(BARBERS) as BarberId[]) : [barber];
  return barbers
    .flatMap((barberId) => {
      const detail = service.barbers[barberId];
      if (!detail) return [];
      const result: Slot[] = [];
      for (
        let time = hours[0];
        time + detail.duration <= hours[1];
        time += 15
      ) {
        const clashes = busy.some(
          (item) =>
            item.barber === barberId &&
            time < item.start + item.duration &&
            time + detail.duration > item.start,
        );
        if (
          !clashes &&
          (date > shopToday() || (date === shopToday() && time > shopMinute()))
        )
          result.push({ barber: barberId, time, ...detail });
      }
      return result;
    })
    .sort((a, b) => a.time - b.time || a.barber.localeCompare(b.barber));
}

export function shopMinute(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return (
    Number(parts.find((p) => p.type === "hour")!.value) * 60 +
    Number(parts.find((p) => p.type === "minute")!.value)
  );
}
export function validDate(value: string) {
  const parsed = parseDate(value);
  return !Number.isNaN(parsed.valueOf()) && dateKey(parsed) === value;
}
export function cancellationFee(
  pricePence: number,
  kind: "late" | "no_show",
  latePercent = 50,
  noShowPercent = 100,
) {
  return Math.round(
    (pricePence * (kind === "late" ? latePercent : noShowPercent)) / 100,
  );
}
