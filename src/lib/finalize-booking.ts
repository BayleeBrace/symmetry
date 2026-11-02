import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import Stripe from "stripe";
import { stripeClient } from "./stripe";
import { createAdminClient } from "./supabase/admin";
import { signLink } from "./security";
import { notifyTrim } from "./staff-push";

/**
 * A card setup that can never become a booking: not made by this site, a
 * draft that has gone or expired, or a time that has been taken since. The
 * webhook acknowledges these so Stripe stops retrying; anything else (Stripe
 * or the database not answering) is worth a retry.
 */
export class PermanentBookingError extends Error {}

/** True when the token the browser kept is the one this booking started with. */
function sameBrowser(token: string | undefined, tokenHash: string) {
  if (!token) return false;
  const given = createHash("sha256").update(token).digest();
  const kept = Buffer.from(tokenHash, "hex");
  return kept.length === given.length && timingSafeEqual(given, kept);
}

/**
 * Turn a finished card setup into the booking. Safe to run more than once:
 * the webhook and the customer's browser both call it. Only the browser that
 * started the booking (holding its random token) gets a manage link back;
 * anyone else finds the link in the confirmation email.
 */
export async function finalizeBooking(
  sessionId: string,
  opts: { token?: string } = {},
): Promise<{ group: string; token: string | null }> {
  const stripe = stripeClient();
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });
  } catch (e) {
    if (
      e instanceof Stripe.errors.StripeInvalidRequestError &&
      e.code === "resource_missing"
    )
      throw new PermanentBookingError("Card setup not found");
    throw e;
  }
  if (session.mode !== "setup" || !session.metadata?.attempt)
    throw new PermanentBookingError("Card setup does not match this booking");
  if (session.status !== "complete")
    throw new Error("Your card setup is not complete yet.");
  const intent = session.setup_intent;
  if (
    !intent ||
    typeof intent === "string" ||
    intent.status !== "succeeded" ||
    !intent.payment_method ||
    !session.customer
  )
    throw new Error("Your card setup is not complete yet.");
  const db = createAdminClient();
  const { data: draft, error } = await db
    .from("booking_attempts")
    .select("id,stripe_session,token_hash,group_id")
    .eq("id", session.metadata.attempt)
    .maybeSingle();
  if (error) throw new Error("Booking could not be confirmed. Please refresh.");
  if (!draft || draft.stripe_session !== session.id)
    throw new PermanentBookingError("Card setup does not match this booking");
  const { data: group, error: err } = await db.rpc("finalize_card_booking", {
    p_attempt: draft.id,
    p_customer:
      typeof session.customer === "string"
        ? session.customer
        : session.customer.id,
    p_method:
      typeof intent.payment_method === "string"
        ? intent.payment_method
        : intent.payment_method.id,
  });
  if (err) {
    const message =
      "Your card was saved, but the trim could not be reserved. No payment was taken. Please choose another time or contact the shop.";
    // Raised by the booking rules (taken, expired, price changed, hours) or a
    // constraint: retrying will not help. Anything else may be passing.
    if (/^(P0001|23|22)/.test(err.code ?? ""))
      throw new PermanentBookingError(message);
    throw new Error(message);
  }
  // Tell the team once the customer has their confirmation, not before, and
  // only the first time (the webhook and the browser both arrive here).
  if (!draft.group_id)
    after(async () => {
      const { data: made } = await db
        .from("bookings")
        .select("id")
        .eq("group_id", group);
      for (const b of made || [])
        await notifyTrim("new_booking", b.id, {
          title: "New booking",
          lead: "Booked online:",
          withNotes: true,
        });
    });
  return {
    group,
    token: sameBrowser(opts.token, draft.token_hash)
      ? signLink("manage", group)
      : null,
  };
}
