import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
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
    time: z.number().int(),
    name: z.string().min(2).max(100),
    email: z.email().or(z.literal("")),
    phone: z.string().max(30),
  }),
]);
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
      const { data: b } = await db
        .from("barbers")
        .select("id")
        .eq("slug", p.barber)
        .single();
      if (!b) throw new Error("Choose a chair");
      const token = createHash("sha256").update(randomBytes(32)).digest("hex");
      const { data: g, error } = await db.rpc("create_booking_group", {
        p_customer_name: p.name,
        p_email: p.email,
        p_phone_country: "GB",
        p_phone: p.phone,
        p_marketing: false,
        p_manage_token_hash: token,
        p_appointments: [
          { barber: p.barber, service: p.service, date: p.date, time: p.time },
        ],
      });
      if (error)
        throw new Error(
          "That slot is unavailable. Check working hours and existing bookings.",
        );
      await db.from("bookings").update({ source: "walk_in" }).eq("group_id", g);
      return privateJson({ ok: true });
    }
    if (p.action === "block") {
      const { error } = await db.from("diary_blocks").insert({
        barber_id: p.barber,
        local_date: p.date,
        start_minute: p.time,
        duration: p.duration,
        label: p.label,
      });
      if (error)
        throw new Error("That block overlaps a booking or another block");
      return privateJson({ ok: true });
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
      if (p.status === "done" && p.paid_by) update.paid_by = p.paid_by;
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
          : { action: p.action },
    });
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
