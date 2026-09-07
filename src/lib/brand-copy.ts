import { validDate } from "./booking-data.ts";
export function showFormerly(
  until = process.env.FORMERLY_UNTIL,
  now = new Date(),
) {
  if (!until) return true; // Set the removal date once the launch date is agreed.
  if (!validDate(until)) throw new Error("FORMERLY_UNTIL must be YYYY-MM-DD");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return today < until;
}
export function shopDescription() {
  return (
    "Independent barbers in Saundersfoot, Pembrokeshire. Book cuts, skin fades and beard trims with Sean, Travis or Dylan at Symmetry" +
    (showFormerly() ? ", formerly Studio 4 Barbers." : ".")
  );
}
