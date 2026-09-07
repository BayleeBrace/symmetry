import { addDays, hourWord, OPENING_HOURS, parseDate } from "./booking-data.ts";
export function openingStatus(hours: typeof OPENING_HOURS, now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const minute =
    Number(parts.find((p) => p.type === "hour")?.value) * 60 +
    Number(parts.find((p) => p.type === "minute")?.value);
  for (let i = 0; i < 8; i++) {
    const day = addDays(date, i),
      h = hours[parseDate(day).getUTCDay()];
    if (!h) continue;
    if (i === 0 && minute >= h[0] && minute < h[1])
      return `Open today until ${hourWord(h[1])}.`;
    if (i === 0 && minute >= h[1]) continue;
    const label =
      i === 0
        ? "today"
        : i === 1
          ? "tomorrow"
          : new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              timeZone: "UTC",
            }).format(parseDate(day));
    return `Next open ${label} at ${hourWord(h[0])}.`;
  }
  return "Opening hours are being updated.";
}
