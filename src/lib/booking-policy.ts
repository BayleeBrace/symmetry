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
export function deadlineLabel(
  date: string,
  minutes: number,
  hours: number,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(cancellationDeadline(date, minutes, hours));
}
