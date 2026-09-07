export const BARBERS = {
  sean: { name: "sean", role: "owner, barber" },
  travis: { name: "travis", role: "senior barber" },
  dylan: { name: "dylan", role: "junior barber" },
} as const;

export type BarberId = keyof typeof BARBERS;
export type BarberChoice = BarberId | "any";

type BarberPrice = Record<BarberId, { price: number; duration: number }>;
export type Service = { id: string; name: string; barbers: BarberPrice };

const prices = (dylan: [number, number], travis: [number, number], sean: [number, number]): BarberPrice => ({
  dylan: { price: dylan[0], duration: dylan[1] },
  travis: { price: travis[0], duration: travis[1] },
  sean: { price: sean[0], duration: sean[1] },
});

export const SERVICES: Service[] = [
  { id: "fade", name: "fade / skin fade", barbers: prices([17, 50], [22, 45], [24, 40]) },
  { id: "fade-beard", name: "fade / skin fade with beard", barbers: prices([20, 60], [25, 50], [27, 45]) },
  { id: "cut", name: "standard cut", barbers: prices([14, 35], [17, 30], [18, 30]) },
  { id: "cut-beard", name: "standard cut with beard", barbers: prices([17, 45], [20, 35], [21, 30]) },
  { id: "under-16", name: "under 16’s fade", barbers: prices([15, 45], [18, 40], [18.5, 35]) },
  { id: "under-13", name: "under 13’s cut", barbers: prices([10, 40], [15, 30], [15.5, 25]) },
  { id: "over-60", name: "over 60’s trim", barbers: prices([10, 40], [12, 25], [12, 25]) },
  { id: "one-length", name: "one length", barbers: prices([10, 20], [12, 15], [12, 15]) },
  { id: "line-beard", name: "line up and beard trim", barbers: prices([8, 20], [10, 15], [10, 15]) },
];

export const OPENING_HOURS: Record<number, [number, number] | null> = {
  0: null, 1: null, 2: [540, 1080], 3: [660, 1140], 4: [660, 1140], 5: [540, 1080], 6: [480, 900],
};

export const money = (value: number) => value % 1 ? value.toFixed(2) : String(value);
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

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
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function fullDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parseDate(value));
}

export function isOpen(value: string) {
  return Boolean(OPENING_HOURS[parseDate(value).getUTCDay()]);
}

export type Slot = { barber: BarberId; time: number; duration: number; price: number };
export type BusyPeriod = { barber: BarberId; start: number; duration: number };

export function makeSlots(date: string, barber: BarberChoice, serviceId: string, busy: BusyPeriod[]) {
  const hours = OPENING_HOURS[parseDate(date).getUTCDay()];
  const service = SERVICES.find((item) => item.id === serviceId);
  if (!hours || !service) return [];
  const barbers = barber === "any" ? Object.keys(BARBERS) as BarberId[] : [barber];
  return barbers.flatMap((barberId) => {
    const detail = service.barbers[barberId];
    const result: Slot[] = [];
    for (let time = hours[0]; time + detail.duration <= hours[1]; time += 15) {
      const clashes = busy.some((item) => item.barber === barberId && time < item.start + item.duration && time + detail.duration > item.start);
      if (!clashes) result.push({ barber: barberId, time, ...detail });
    }
    return result;
  }).sort((a, b) => a.time - b.time || a.barber.localeCompare(b.barber));
}
