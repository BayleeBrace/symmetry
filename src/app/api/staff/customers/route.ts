import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
import { shopToday, shopMinute } from "@/lib/booking-data";

const profile = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .or(z.literal(""))
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+[1-9]\d{6,14}$/,
      "Use the full mobile number including +44 or its country code",
    )
    .or(z.literal("")),
  preferences: z.string().max(1000),
});
const fields = "id,name,email,phone,phone_country,preferences,created_at";

// Every signed-in barber can look clients up and see their history; only the owner can edit details.
export async function GET(req: Request) {
  try {
    await requireStaff();
    const db = createAdminClient();
    const params = new URL(req.url).searchParams;
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .parse(params.get("page") || 0);
    const id = params.get("id");
    if (id) {
      z.uuid().parse(id);
      const customer = await db
        .from("customers")
        .select(fields)
        .eq("id", id)
        .single();
      if (customer.error)
        return privateJson({ error: "Client not found" }, 404);
      const past = params.get("period") === "past";
      const today = shopToday(),
        minute = shopMinute();
      let query = db
        .from("bookings")
        .select(
          "id,local_date,start_minute,duration,price_pence,status,paid_by,barbers(name),services(name),booking_groups!inner(customer_id)",
          { count: "exact" },
        )
        .eq("booking_groups.customer_id", id);
      query = past
        ? query.or(
            `local_date.lt.${today},and(local_date.eq.${today},start_minute.lt.${minute})`,
          )
        : query.or(
            `local_date.gt.${today},and(local_date.eq.${today},start_minute.gte.${minute})`,
          );
      const [bookings, all] = await Promise.all([
        query
          .order("local_date", { ascending: !past })
          .order("start_minute", { ascending: !past })
          .order("id")
          .range(page * 20, page * 20 + 19),
        db
          .from("bookings")
          .select(
            "status,price_pence,local_date,booking_groups!inner(customer_id)",
          )
          .eq("booking_groups.customer_id", id)
          .limit(2000),
      ]);
      if (bookings.error || all.error)
        throw new Error("Booking history could not load");
      const rows = all.data;
      return privateJson({
        customer: customer.data,
        bookings: bookings.data,
        count: bookings.count,
        stats: {
          visits: rows.filter((b) => b.status === "done").length,
          noShows: rows.filter((b) => b.status === "no_show").length,
          cancelled: rows.filter((b) => b.status === "cancelled").length,
          spent: rows
            .filter((b) => b.status === "done")
            .reduce((s, b) => s + b.price_pence, 0),
          upcoming: rows.filter(
            (b) =>
              ["booked", "arrived"].includes(b.status) && b.local_date >= today,
          ).length,
        },
      });
    }
    const term = (params.get("q") || "")
      .trim()
      .slice(0, 100)
      .replace(/[^\p{L}\p{N}@+ ._'-]/gu, "")
      .replace(/[_%]/g, "");
    let query = db
      .from("customers")
      .select(fields, { count: "exact" })
      .is("directory_parent_id", null)
      // The one-tap "Walk-in" client from the calendar is not a real record.
      .neq("name", "Walk-in");
    if (term)
      query = query.or(
        `name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term.replace(/\s/g, "")}%`,
      );
    const result = await query
      .order("name")
      .order("id")
      .range(page * 20, page * 20 + 19);
    if (result.error) throw new Error("Clients could not load");
    return privateJson({ customers: result.data, count: result.count });
  } catch (e) {
    return publicError(e, 403);
  }
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    await requireStaff(true);
    const body = z
      .object({
        id: z.uuid(),
        changes: profile,
        original: z.object({
          name: z.string(),
          email: z.string(),
          phone: z.string(),
          preferences: z.string(),
        }),
      })
      .parse(await req.json());
    const country = parsePhoneNumberFromString(body.changes.phone)?.country;
    let query = createAdminClient()
      .from("customers")
      .update({
        ...body.changes,
        ...(country ? { phone_country: country } : {}),
      })
      .eq("id", body.id)
      .is("directory_parent_id", null);
    // Only save over the values the screen was showing, so two people cannot overwrite each other.
    for (const key of ["name", "email", "phone", "preferences"] as const)
      query = query.eq(key, body.original[key]);
    const result = await query.select(fields).maybeSingle();
    if (result.error) throw new Error("Client details could not be saved");
    if (!result.data)
      return privateJson(
        { error: "This profile changed elsewhere. Reopen it before saving." },
        409,
      );
    return privateJson({ customer: result.data });
  } catch (e) {
    return publicError(e);
  }
}
