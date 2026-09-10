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
export async function GET(req: Request) {
  try {
    await requireStaff(true);
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
        return privateJson({ error: "Customer not found" }, 404);
      const past = params.get("period") === "past";
      const today = shopToday(),
        minute = shopMinute();
      let query = db
        .from("bookings")
        .select(
          "id,local_date,start_minute,duration,price_pence,status,barbers(name),services(name),booking_groups!inner(customer_id)",
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
      const bookings = await query
        .order("local_date", { ascending: !past })
        .order("start_minute", { ascending: !past })
        .order("id")
        .range(page * 20, page * 20 + 19);
      if (bookings.error) throw new Error("Booking history could not load");
      return privateJson({
        customer: customer.data,
        bookings: bookings.data,
        count: bookings.count,
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
      .is("directory_parent_id", null);
    if (term)
      query = query.or(
        `name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term.replace(/\s/g, "")}%`,
      );
    const result = await query
      .order("name")
      .order("id")
      .range(page * 20, page * 20 + 19);
    if (result.error) throw new Error("Customers could not load");
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
    let query = createAdminClient()
      .from("customers")
      .update({
        ...body.changes,
        ...(parsePhoneNumberFromString(body.changes.phone)?.country
          ? {
              phone_country: parsePhoneNumberFromString(body.changes.phone)!
                .country,
            }
          : {}),
      })
      .eq("id", body.id)
      .is("directory_parent_id", null);
    for (const key of ["name", "email", "phone", "preferences"] as const)
      query = query.eq(key, body.original[key]);
    const result = await query.select(fields).maybeSingle();
    if (result.error) throw new Error("Customer details could not be saved");
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
