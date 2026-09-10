import { z } from "zod";
import { after } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyFee,
  notifySlotFreed,
  notifyTrim,
  staffName,
} from "@/lib/staff-push";
import {
  addDays,
  validDate,
  shopToday,
  shopMinute,
  parseDate,
} from "@/lib/booking-data";
import { getCatalog } from "@/lib/catalog";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
const actions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    id: z.uuid(),
    status: z.enum(["arrived", "done", "no_show", "cancelled"]),
    version: z.string(),
    paid_by: z.enum(["card", "cash", "other"]).optional(),
    // At checkout the barber can record what was actually done and charged.
    service: z.uuid().optional(),
    price_pence: z.number().int().min(0).max(100000).optional(),
  }),
  z.object({
    action: z.literal("move"),
    id: z.uuid(),
    date: z.string().refine(validDate),
    time: z.number().int().min(0).max(1439),
    barber: z.uuid().optional(),
    version: z.string(),
  }),
  z.object({
    action: z.literal("block"),
    barber: z.uuid(),
    date: z.string().refine(validDate),
    time: z.number().int().min(0).max(1439),
    duration: z.number().int().min(5).max(1440),
    label: z.string().min(1).max(80),
    // A run of days off: one block per day from date to until.
    until: z.string().refine(validDate).optional(),
  }),
  z.object({ action: z.literal("unblock"), id: z.uuid() }),
  z.object({
    action: z.literal("running_behind"),
    barber: z.uuid(),
    minutes: z.number().int().min(5).max(60),
  }),
  z.object({
    action: z.literal("walkin"),
    barber: z.string(),
    service: z.string(),
    date: z.string().refine(validDate),
    time: z.number().int().min(0).max(1439),
    name: z.string().min(2).max(100),
    email: z.email().or(z.literal("")),
    phone: z.string().max(30),
    // Book over a taken slot on purpose; the calendar draws the two side by side.
    squeeze: z.boolean().optional(),
    // A regular: the same trim every N weeks, this many times in all.
    repeat: z
      .object({
        every: z.number().int().min(1).max(4),
        times: z.number().int().min(2).max(12),
      })
      .optional(),
  }),
]);

const WALK_IN = "Walk-in";

/**
 * A trim added by staff goes straight into the diary. The database trigger
 * still checks hours, shifts, blocks and the date; the no-overlap rule is
 * skipped only for a trim marked squeezed.
 */
async function addStaffTrims(
  db: ReturnType<typeof createAdminClient>,
  p: Extract<z.infer<typeof actions>, { action: "walkin" }>,
) {
  const { data: barber } = await db
    .from("barbers")
    .select("id")
    .eq("slug", p.barber)
    .eq("active", true)
    .maybeSingle();
  if (!barber) throw new Error("Choose a chair");
  const { data: service } = await db
    .from("services")
    .select("id")
    .eq("slug", p.service)
    .eq("active", true)
    .maybeSingle();
  if (!service) throw new Error("Choose a service");
  const { data: price } = await db
    .from("service_prices")
    .select("duration,price_pence")
    .eq("barber_id", barber.id)
    .eq("service_id", service.id)
    .eq("active", true)
    .maybeSingle();
  if (!price) throw new Error("No price is set for this chair and service");

  // Reuse a client only on an exact match, the same rule as online bookings.
  // Walk-ins without details share one hidden "Walk-in" record.
  const name = p.name.trim();
  const email = p.email.trim().toLowerCase();
  // Mobiles are kept in international form so texts can reach them.
  const typed = p.phone.trim();
  const parsed = typed ? parsePhoneNumberFromString(typed, "GB") : undefined;
  const phone = parsed?.isValid() ? parsed.number : typed;
  const walkIn = name === WALK_IN && !email && !phone;
  let customerId: string | null = null;
  if (walkIn || (email && phone)) {
    const { data: existing } = await db
      .from("customers")
      .select("id")
      .ilike("name", name)
      .eq("email", email)
      .eq("phone", phone)
      .is("auth_user_id", null)
      .is("directory_parent_id", null)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    customerId = existing?.id ?? null;
  }
  if (!customerId) {
    const { data: made, error } = await db
      .from("customers")
      .insert({ name, email, phone_country: "GB", phone })
      .select("id")
      .single();
    if (error || !made) throw new Error("The client could not be saved");
    customerId = made.id;
  }
  const token = createHash("sha256").update(randomBytes(32)).digest("hex");
  const { data: group, error: groupError } = await db
    .from("booking_groups")
    .insert({ customer_id: customerId, manage_token_hash: token })
    .select("id")
    .single();
  if (groupError || !group) throw new Error("The booking could not be saved");

  const dates = p.repeat
    ? Array.from({ length: p.repeat.times }, (_, i) =>
        addDays(p.date, i * p.repeat!.every * 7),
      )
    : [p.date];
  let made = 0;
  let firstError = "";
  const ids: string[] = [];
  for (const date of dates) {
    const { data: row, error } = await db
      .from("bookings")
      .insert({
        group_id: group.id,
        barber_id: barber.id,
        service_id: service.id,
        local_date: date,
        start_minute: p.time,
        duration: price.duration,
        price_pence: price.price_pence,
        source: "walk_in",
        ...(p.squeeze ? { squeezed: true } : {}),
      })
      .select("id")
      .maybeSingle();
    if (!error) {
      made++;
      if (row) ids.push(row.id);
      continue;
    }
    if (!firstError)
      firstError =
        error.code === "23P01"
          ? "That time is taken. Pick another, or squeeze it in."
          : /squeezed/.test(error.message)
            ? "Squeeze-ins need the 20260911090000_squeeze_in migration first."
            : error.message.replace(/^.*?: /, "") ||
              "That slot is unavailable. Check working hours and existing bookings.";
  }
  if (!made) {
    await db.from("booking_groups").delete().eq("id", group.id);
    throw new Error(firstError || "The booking could not be saved");
  }
  return { ok: true, made, skipped: dates.length - made, ids };
}
export async function GET(req: Request) {
  try {
    const staff = await requireStaff();
    const db = createAdminClient();
    const params = new URL(req.url).searchParams;
    const date = params.get("date") || shopToday();
    if (!validDate(date)) throw new Error("Choose a date");
    // One day by default; up to seven for the week view.
    const days = Math.min(7, Math.max(1, Number(params.get("days")) || 1));
    const to = addDays(date, days - 1);
    const q = db
      .from("bookings")
      .select(
        "*,barbers(name,slug),services(name),booking_groups(customer_id,customers(name,email,phone,preferences),policy_snapshot)",
      )
      .gte("local_date", date)
      .lte("local_date", to)
      .order("local_date")
      .order("start_minute");
    const blocks = db
      .from("diary_blocks")
      .select("*")
      .gte("local_date", date)
      .lte("local_date", to);
    // Every chair for everyone: the team reference each other's days.
    const [rows, br, bl, sv, pr, sh, catalog] = await Promise.all([
      q,
      db.from("barbers").select("*"),
      blocks,
      db.from("services").select("*").eq("active", true),
      db.from("service_prices").select("*"),
      db
        .from("barber_schedules")
        .select("barber_id,iso_weekday,open_minute,close_minute"),
      getCatalog(),
    ]);
    if (rows.error || br.error || bl.error || sv.error || pr.error || sh.error)
      throw new Error("The diary could not load");
    const ids = rows.data.map((b) => b.id);
    const { data: events } = await db
      .from("booking_events")
      .select("id,booking_id,kind,created_at")
      .in("booking_id", ids)
      .order("created_at", { ascending: false })
      .limit(30);
    // What each customer on the page has done before: visits, no shows, last trim.
    const customerIds = [
      ...new Set(
        rows.data
          .map(
            (b) =>
              (b.booking_groups as unknown as { customer_id?: string } | null)
                ?.customer_id,
          )
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const history: Record<
      string,
      {
        visits: number;
        noShows: number;
        last: { date: string; barber_id: string; service_id: string } | null;
      }
    > = {};
    for (const id of customerIds)
      history[id] = { visits: 0, noShows: 0, last: null };
    if (customerIds.length) {
      const { data: past } = await db
        .from("bookings")
        .select(
          "local_date,status,barber_id,service_id,booking_groups!inner(customer_id)",
        )
        .in("booking_groups.customer_id", customerIds)
        .in("status", ["done", "no_show"])
        .lt("local_date", date)
        .order("local_date", { ascending: false })
        .limit(3000);
      for (const b of past || []) {
        const h =
          history[
            (b.booking_groups as unknown as { customer_id: string }).customer_id
          ];
        if (!h) continue;
        if (b.status === "no_show") h.noShows++;
        else {
          h.visits++;
          h.last ??= {
            date: b.local_date,
            barber_id: b.barber_id,
            service_id: b.service_id,
          };
        }
      }
    }
    return privateJson({
      staff,
      date,
      to,
      hours: catalog.hours[parseDate(date).getUTCDay()] ?? null,
      hoursByDay: Object.fromEntries(
        Array.from({ length: days }, (_, i) => addDays(date, i)).map((d) => [
          d,
          catalog.hours[parseDate(d).getUTCDay()] ?? null,
        ]),
      ),
      bookings: rows.data,
      barbers: br.data,
      shifts: sh.data,
      blocks: bl.data,
      services: sv.data,
      prices: pr.data,
      events: events || [],
      history,
    });
  } catch (e) {
    return publicError(e, 403);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff();
    const p = actions.parse(await req.json());
    const db = createAdminClient();
    if (p.action === "walkin") {
      const result = await addStaffTrims(db, p);
      // The chair's barber hears when someone else books onto their diary.
      if (result.ids[0])
        after(async () =>
          notifyTrim("added_by_team", result.ids[0], {
            title: "Added to your diary",
            lead: `${await staffName(staff)} added ${
              result.made > 1 ? `${result.made} trims, the first` : "a trim"
            }:`,
            except: staff.user_id,
            chairOnly: true,
          }),
        );
      const body = { ok: true, made: result.made, skipped: result.skipped };
      return privateJson(body);
    }
    if (p.action === "block") {
      const last = p.until && p.until > p.date ? p.until : p.date;
      if (last > addDays(p.date, 62))
        throw new Error("Block up to nine weeks at a time");
      let made = 0;
      let skipped = 0;
      for (let d = p.date; d <= last; d = addDays(d, 1)) {
        const { error } = await db.from("diary_blocks").insert({
          barber_id: p.barber,
          local_date: d,
          start_minute: p.time,
          duration: p.duration,
          label: p.label,
        });
        if (error) skipped++;
        else made++;
      }
      if (!made)
        throw new Error(
          skipped > 1
            ? "Those days have bookings or blocks already. Move the bookings first."
            : "That block overlaps a booking or another block",
        );
      return privateJson({ ok: true, made, skipped });
    }
    if (p.action === "unblock") {
      const { error } = await db.from("diary_blocks").delete().eq("id", p.id);
      if (error) throw new Error("Block could not be removed");
      return privateJson({ ok: true });
    }
    if (p.action === "running_behind") {
      // Tell the next two customers this chair is running late, by text where we can, else email.
      const now = shopMinute();
      const { data: rows, error } = await db
        .from("bookings")
        .select(
          "id,group_id,start_minute,duration,booking_groups(customers(email,phone))",
        )
        .eq("barber_id", p.barber)
        .eq("local_date", shopToday())
        .eq("status", "booked")
        .order("start_minute");
      if (error) throw new Error("The diary could not load");
      const next = (rows || [])
        .filter((b) => b.start_minute + b.duration > now)
        .slice(0, 2);
      const bucket = Math.floor(Date.now() / 600000);
      const smsReady = Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_FROM,
      );
      let told = 0;
      for (const b of next) {
        const customer = (
          b.booking_groups as unknown as {
            customers: { email: string | null; phone: string | null } | null;
          } | null
        )?.customers;
        const phone = customer?.phone || "";
        const channel =
          smsReady && phone.startsWith("+")
            ? "sms"
            : customer?.email
              ? "email"
              : null;
        if (!channel) continue;
        const { error: queue } = await db.from("notification_jobs").upsert(
          {
            dedupe_key: `delayed-${b.id}-${bucket}`,
            group_id: b.group_id,
            booking_id: b.id,
            kind: "delayed",
            channel,
            payload: { minutes: p.minutes },
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        );
        if (queue) continue;
        await db.from("booking_events").insert({
          booking_id: b.id,
          group_id: b.group_id,
          kind: "staff_action",
          actor: staff.user_id,
          detail: { action: "running_behind", minutes: p.minutes },
        });
        told++;
      }
      return privateJson({ ok: true, told });
    }
    const { data: b } = await db
      .from("bookings")
      .select("*,booking_groups(policy_snapshot)")
      .eq("id", p.id)
      .single();
    if (!b) throw new Error("This trim is not in the diary");
    if (!["booked", "arrived"].includes(b.status))
      throw new Error("This trim is already closed");
    let update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (p.action === "move") {
      update = { ...update, local_date: p.date, start_minute: p.time };
      // Dragged onto another chair: same trim, same price, different barber.
      if (p.barber && p.barber !== b.barber_id) update.barber_id = p.barber;
    } else {
      if (
        ["done", "no_show"].includes(p.status) &&
        (b.local_date > shopToday() ||
          (b.local_date === shopToday() && b.start_minute > shopMinute()))
      )
        throw new Error("This trim has not started yet");
      update.status = p.status;
      if (p.status === "done") {
        if (p.paid_by) update.paid_by = p.paid_by;
        // What was actually done and charged, if it differs from the booking.
        if (p.service && p.service !== b.service_id) {
          const { data: price } = await db
            .from("service_prices")
            .select("price_pence")
            .eq("barber_id", b.barber_id)
            .eq("service_id", p.service)
            .eq("active", true)
            .maybeSingle();
          if (!price)
            throw new Error("That service has no price on this chair");
          update.service_id = p.service;
          update.price_pence = price.price_pence;
        }
        if (p.price_pence !== undefined) update.price_pence = p.price_pence;
      }
      if (p.status === "no_show") {
        const percent = b.booking_groups?.policy_snapshot?.no_show_percent || 0;
        update.fee_pence = Math.round((b.price_pence * percent) / 100);
        update.fee_status = percent ? "review" : "none";
      }
    }
    const { data, error } = await db
      .from("bookings")
      .update(update)
      .eq("id", b.id)
      .eq("updated_at", p.version)
      .select("id")
      .maybeSingle();
    if (error || !data)
      throw new Error(
        "The diary changed or that time is unavailable. Refresh and try again.",
      );
    await db.from("booking_events").insert({
      booking_id: b.id,
      group_id: b.group_id,
      kind: "staff_action",
      actor: staff.user_id,
      detail:
        p.action === "move"
          ? {
              action: "move",
              from: {
                date: b.local_date,
                time: b.start_minute,
                barber: b.barber_id,
              },
              to: {
                date: p.date,
                time: p.time,
                barber: p.barber ?? b.barber_id,
              },
            }
          : {
              action: p.action,
              status: p.status,
              ...(update.service_id
                ? { service: { from: b.service_id, to: update.service_id } }
                : {}),
              ...(update.price_pence !== undefined &&
              update.price_pence !== b.price_pence
                ? { price: { from: b.price_pence, to: update.price_pence } }
                : {}),
            },
    });
    // The chair's barber hears when someone else on the team moves or cancels their trim.
    if (
      p.action === "move" ||
      (p.action === "status" && p.status === "cancelled")
    )
      after(async () => {
        const who = await staffName(staff);
        await notifyTrim(p.action === "move" ? "moved" : "cancelled", b.id, {
          title: p.action === "move" ? "Trim moved" : "Trim cancelled",
          lead:
            p.action === "move"
              ? `${who} moved a trim on your diary. Now:`
              : `${who} cancelled a trim on your diary:`,
          except: staff.user_id,
          chairOnly: true,
        });
        // The old slot is free again: worth knowing if people are waiting for that day.
        await notifySlotFreed(
          b.id,
          { date: b.local_date, barberId: b.barber_id },
          staff.user_id,
        );
      });
    // A no-show fee is up for review: tell the owner, unless the owner marked it.
    if (
      p.action === "status" &&
      p.status === "no_show" &&
      update.fee_status === "review"
    )
      after(() => notifyFee(b.id, "no show", staff.user_id));
    if (p.action === "status" && p.status === "done") {
      // One thank-you per trim, two hours later, with the review link when one is configured.
      await db.from("notification_jobs").upsert(
        {
          dedupe_key: "thanks-" + b.id,
          group_id: b.group_id,
          booking_id: b.id,
          kind: "thanks",
          channel: "email",
          due_at: new Date(Date.now() + 2 * 3600000).toISOString(),
        },
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      );
    }
    return privateJson({ ok: true });
  } catch (e) {
    return publicError(e, 409);
  }
}
