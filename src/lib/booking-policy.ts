/** Converts a shop wall-clock time to an instant, independent of the customer's timezone. */
export function shopInstant(date: string, minutes: number): Date {
  const [year, month, day] = date.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, 0, minutes);
  let instant = wall;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
    );
    const rendered = Date.UTC(
      +parts.year,
      +parts.month - 1,
      +parts.day,
      +parts.hour,
      +parts.minute,
      +parts.second,
    );
    instant += wall - rendered;
  }
  return new Date(instant);
}
export function cancellationDeadline(
  date: string,
  minutes: number,
  hours: number,
): Date {
  return new Date(shopInstant(date, minutes).getTime() - hours * 3600000);
}
/** The deadline in shop time, written the way the site writes trims: "Tue, 15 September 2026 at 7:50". */
export function deadlineLabel(
  date: string,
  minutes: number,
  hours: number,
): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(cancellationDeadline(date, minutes, hours))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year} at ${Number(parts.hour)}:${String(Number(parts.minute)).padStart(2, "0")}`;
}
