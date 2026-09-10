import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, shopToday, validDate } from "@/lib/booking-data";
import { sameOrigin, privateJson, publicError } from "@/lib/security";

/**
 * The waitlist from the team's side: who is waiting for a day, and putting
 * someone on it when they ring and the day is full. A staff-added entry is
 * trusted straight away (no confirm email) and is offered a freed slot by
 * text when a mobile is given, or by email.
 */
const actions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    date: z.string().refine(validDate),
    until: z.string().refine(validDate).optional(),
    barber: z.uuid().nullable(),
    service: z.uuid(),
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30),
    email: z.email().max(254).or(z.literal("")),
  }),
  z.object({ action: z.literal("remove"), id: z.uuid() }),
]);

export async function GET(req: Request) {
  try {
    await requireStaff();
    const params = new URL(req.url).searchParams;
    const date = params.get("date");
    const db = createAdminClient();
    let q = db
      .from("waitlist_requests")
      .select(
        "id,preferred_date,until_date,offered_at,barber_id,service_id,email,phone,verified,created_at,barbers(name),services(name),customers(name)",
      )
      .eq("active", true)
      .order("preferred_date")
      .order("created_at");
    // A request covers one day, or a run of days up to until_date.
    q =
      date && validDate(date)
        ? q
            .lte("preferred_date", date)
            .or(
              `until_date.gte.${date},and(until_date.is.null,preferred_date.eq.${date})`,
            )
        : q
            .lte("preferred_date", addDays(shopToday(), 60))
            .or(
              `until_date.gte.${shopToday()},and(until_date.is.null,preferred_date.gte.${shopToday()})`,
            );
    const { data, error } = await q.limit(200);
    if (error) throw new Error("The waitlist could not load");
    return privateJson({
      waiting: (data || []).map((w) => ({
        id: w.id,
        date: w.preferred_date,
        until: w.until_date ?? null,
        offered: Boolean(
          w.offered_at &&
          Date.now() - new Date(w.offered_at).getTime() < 5 * 60000,
        ),
        barber_id: w.barber_id,
        barber: (w.barbers as unknown as { name: string } | null)?.name ?? null,
        service:
          (w.services as unknown as { name: string } | null)?.name ?? "Trim",
        name:
          (w.customers as unknown as { name: string } | null)?.name ??
          w.email ??
          "Someone",
        phone: w.phone ?? "",
        email: w.email ?? "",
        verified: w.verified,
      })),
    });
  } catch (e) {
    return publicError(e, 403);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await requireStaff();
    const p = actions.parse(await req.json());
    const db = createAdminClient();
    if (p.action === "remove") {
      const { error } = await db
        .from("waitlist_requests")
        .update({ active: false })
        .eq("id", p.id);
      if (error) throw new Error("Could not take them off the list");
      return privateJson({ ok: true });
    }
    if (p.date < shopToday() || p.date > addDays(shopToday(), 120))
      throw new Error("Choose a day within the next 120 days");
    const until = p.until && p.until > p.date ? p.until : null;
    if (until && until > addDays(p.date, 14))
      throw new Error("Choose a run of up to two weeks");
    const parsed = p.phone ? parsePhoneNumberFromString(p.phone, "GB") : null;
    const phone = parsed?.isValid() ? parsed.number : p.phone;
    const email = p.email.trim().toLowerCase();
    if (!phone && !email)
      throw new Error("A mobile number or an email, so they can be told");
    // Reuse their client record on an exact match, else make one.
    let query = db
      .from("customers")
      .select("id")
      .ilike("name", p.name)
      .is("auth_user_id", null)
      .is("directory_parent_id", null);
    query = phone ? query.eq("phone", phone) : query.eq("email", email);
    const { data: existing } = await query
      .order("created_at")
      .limit(1)
      .maybeSingle();
    let customerId = existing?.id as string | undefined;
    if (!customerId) {
      const { data: made, error } = await db
        .from("customers")
        .insert({ name: p.name, email, phone_country: "GB", phone })
        .select("id")
        .single();
      if (error || !made) throw new Error("The client could not be saved");
      customerId = made.id;
    }
    const { error } = await db.from("waitlist_requests").insert({
      customer_id: customerId,
      barber_id: p.barber,
      service_id: p.service,
      preferred_date: p.date,
      ...(until ? { until_date: until } : {}),
      email,
      phone,
      verified: true,
      active: true,
      token_hash: createHash("sha256").update(randomBytes(32)).digest("hex"),
    });
    if (error)
      throw new Error(
        error.code === "23505"
          ? "They are already on the list for that day"
          : "Could not add them to the list",
      );
    return privateJson({ ok: true });
  } catch (e) {
    return publicError(e, 409);
  }
}
