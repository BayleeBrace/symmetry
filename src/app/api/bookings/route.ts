import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
// Full metadata, so the line type (mobile or landline) is known for every country.
import { parsePhoneNumberFromString as parseWithTypes } from "libphonenumber-js/max";
import {
  addDays,
  shopToday,
  shopMinute,
  validDate,
  parseDate,
} from "@/lib/booking-data";
import { createAdminClient, hasSupabase } from "@/lib/supabase/admin";
import { busyFor } from "@/lib/availability";
import { getCatalog, getPolicy } from "@/lib/catalog";
import { stripeClient } from "@/lib/stripe";
import {
  rateLimit,
  sameOrigin,
  siteUrl,
  privateJson,
  publicError,
} from "@/lib/security";
const schema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    email: z.email().max(254),
    country: z.string().length(2),
    phone: z.string().max(30),
    marketing: z.boolean(),
    preferences: z.string().max(1000).optional(),
  }),
  policyAccepted: z.literal(true),
  policyVersion: z.string().max(100),
  requestId: z.uuid(),
  appointments: z
    .array(
      z.object({
        date: z.string().refine(validDate),
        barber: z.enum(["sean", "travis", "dylan"]),
        service: z.string().max(40),
        time: z.number().int().min(0).max(1439),
        price: z.number().min(0),
        duration: z.number().int().min(5),
      }),
    )
    .min(1)
    .max(12),
});
// Numbers that are certainly not mobiles, so a text would never arrive.
// Anything that might be a mobile (or whose type is unknown) is allowed.
const NOT_MOBILE = new Set([
  "FIXED_LINE",
  "TOLL_FREE",
  "PREMIUM_RATE",
  "SHARED_COST",
  "UAN",
  "VOICEMAIL",
  "PAGER",
]);
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await rateLimit(request, "book", 10);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return privateJson(
        { error: "Check your details and accept the cancellation policy." },
        400,
      );
    const { customer, appointments, requestId } = parsed.data;
    const phone = parsePhoneNumberFromString(
      customer.phone,
      customer.country as CountryCode,
    );
    if (!phone?.isValid())
      return privateJson({ error: "Enter a valid mobile number." }, 400);
    if (NOT_MOBILE.has(parseWithTypes(phone.number)?.getType() ?? ""))
      return privateJson({ error: "Enter a mobile number." }, 400);
    customer.phone = phone.number;
    const catalog = await getCatalog(),
      policy = await getPolicy();
    if (parsed.data.policyVersion !== policy.version)
      throw new Error(
        "The cancellation policy changed. Refresh and review it before booking.",
      );
    const normalised = appointments.map((a) => {
      const detail = catalog.services.find((s) => s.id === a.service)?.barbers[
        a.barber
      ];
      const hours = catalog.hours[parseDate(a.date).getUTCDay()];
      if (
        !detail ||
        a.price !== detail.price ||
        a.duration !== detail.duration ||
        !hours ||
        a.date < shopToday() ||
        a.date > addDays(shopToday(), 120) ||
        a.time % 15 ||
        a.time < hours[0] ||
        a.time + detail.duration > hours[1] ||
        (a.date === shopToday() && a.time <= shopMinute())
      )
        throw new Error("Choose a future available trim.");
      return { ...a, ...detail };
    });
    for (let i = 0; i < normalised.length; i++)
      for (let j = i + 1; j < normalised.length; j++) {
        const a = normalised[i],
          b = normalised[j];
        if (
          a.date === b.date &&
          a.time < b.time + b.duration &&
          a.time + a.duration > b.time
        )
          throw new Error("Two of your trims overlap.");
      }
    if (!hasSupabase())
      return privateJson({
        mode: "preview",
        reference: "PREVIEW-" + randomBytes(3).toString("hex"),
      });
    if (
      process.env.BOOKINGS_ENABLED !== "true" ||
      !policy.policy_confirmed ||
      (process.env.LINK_SIGNING_SECRET?.length || 0) < 32 ||
      !process.env.RESEND_API_KEY ||
      !process.env.EMAIL_FROM ||
      !process.env.STRIPE_WEBHOOK_SECRET
    )
      return privateJson(
        { error: "Online booking is not open yet. Please contact the shop." },
        503,
      );
    // The same busy check the times on the page come from, so a time taken
    // since the page loaded is turned down before the customer adds a card.
    const busy = new Map<string, Awaited<ReturnType<typeof busyFor>>>();
    for (const a of normalised) {
      const key = a.date + " " + a.barber;
      if (!busy.has(key)) busy.set(key, await busyFor(a.date, a.barber));
      if (
        busy
          .get(key)!
          .some(
            (b) =>
              b.barber === a.barber &&
              a.time < b.start + b.duration &&
              a.time + a.duration > b.start,
          )
      )
        return privateJson(
          {
            error:
              "One of your trims has just been taken. Choose another time.",
          },
          409,
        );
    }
    const db = createAdminClient();
    const { data: existing, error: lookupError } = await db
      .from("booking_attempts")
      .select("stripe_session")
      .eq("id", requestId)
      .maybeSingle();
    if (lookupError) throw new Error("Booking could not start");
    // A reused request ID never reveals another customer's checkout session.
    if (existing)
      return privateJson(
        {
          error:
            "This booking request has already started. Return to your card setup or start again.",
        },
        409,
      );
    const token = randomBytes(32).toString("base64url");
    const { error } = await db.from("booking_attempts").insert({
      id: requestId,
      token_hash: createHash("sha256").update(token).digest("hex"),
      payload: { customer, appointments, policy },
    });
    if (error) throw new Error("Booking could not start");
    const stripe = stripeClient();
    const sc = await stripe.customers.create(
      { email: customer.email, name: customer.name, phone: customer.phone },
      { idempotencyKey: "customer-" + requestId },
    );
    const session = await stripe.checkout.sessions.create(
      {
        mode: "setup",
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        customer: sc.id,
        payment_method_types: ["card"],
        setup_intent_data: { metadata: { attempt: requestId } },
        metadata: { attempt: requestId },
        success_url: siteUrl() + "/bookings?setup={CHECKOUT_SESSION_ID}",
        cancel_url: siteUrl() + "/book?card=cancelled",
        custom_text: {
          submit: {
            message: `No deposit. Cancel at least ${policy.cancellation_hours} hours before for free. Late cancellation: ${policy.late_percent}%. No-show: ${policy.no_show_percent}%. Your card may be charged under this policy.`,
          },
        },
      },
      { idempotencyKey: "setup-" + requestId },
    );
    const { error: saveError } = await db
      .from("booking_attempts")
      .update({ stripe_session: session.id })
      .eq("id", requestId);
    if (saveError) throw new Error("Card setup could not be saved");
    // The tab keeps this token through the card page and hands it back, so
    // only the browser that made the booking is given its manage link.
    return privateJson({
      mode: "card_setup",
      url: session.url,
      completion: token,
    });
  } catch (error) {
    return publicError(error);
  }
}
