import { NextRequest } from "next/server";
import { z } from "zod";
import { loadManagedBookingGroup } from "@/lib/manage-bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  token: z.string().min(20).max(2000),
  booking: z.uuid().optional(),
});

const calendarTime = (date: string, minutes: number) => {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${date.replaceAll("-", "")}T${hours}${mins}00`;
};

const escapeCalendarText = (value: string) => value
  .replaceAll("\\", "\\\\")
  .replaceAll(";", "\\;")
  .replaceAll(",", "\\,")
  .replaceAll("\n", "\\n");

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return new Response("Invalid calendar link.", { status: 400 });

  const group = await loadManagedBookingGroup(parsed.data.token);
  if (!group) return new Response("Those bookings could not be found.", { status: 404 });

  const appointments = group.appointments.filter((item) =>
    ["booked", "arrived"].includes(item.status) && (!parsed.data.booking || item.id === parsed.data.booking),
  );
  if (!appointments.length) return new Response("There are no active trims to add.", { status: 404 });

  const manageUrl = `${request.nextUrl.origin}/bookings?token=${encodeURIComponent(parsed.data.token)}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = appointments.flatMap((appointment) => [
    "BEGIN:VEVENT",
    `UID:${appointment.id}@symmetrywales.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/London:${calendarTime(appointment.date, appointment.time)}`,
    `DTEND;TZID=Europe/London:${calendarTime(appointment.date, appointment.time + appointment.duration)}`,
    `SUMMARY:${escapeCalendarText(`${appointment.service.name} with ${appointment.barber.name} · Symmetry`)}`,
    `DESCRIPTION:${escapeCalendarText(`Manage or cancel this trim: ${manageUrl}`)}`,
    `LOCATION:${escapeCalendarText("Symmetry Barbers, 4 Brewery Terrace, Saundersfoot, SA69 9HG")}`,
    `URL:${manageUrl}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ]);
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Symmetry Barbers//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Symmetry trims",
    "X-WR-TIMEZONE:Europe/London",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/London",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T010000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "TZOFFSETFROM:+0000",
    "TZOFFSETTO:+0100",
    "TZNAME:BST",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "DTSTART:19701025T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0000",
    "TZNAME:GMT",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(calendar, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${parsed.data.booking ? "symmetry-trim" : "symmetry-trims"}.ics"`,
      "cache-control": "private, no-store",
    },
  });
}
