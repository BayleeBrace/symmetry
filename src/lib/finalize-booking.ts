import "server-only";
import { after } from "next/server";
import { stripeClient } from "./stripe";
import { createAdminClient } from "./supabase/admin";
import { signLink } from "./security";
import { notifyTrim } from "./staff-push";
export async function finalizeBooking(sessionId: string) {
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["setup_intent"],
  });
  if (
    session.mode !== "setup" ||
    session.status !== "complete" ||
    !session.metadata?.attempt
  )
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
    .select("id,stripe_session")
    .eq("id", session.metadata.attempt)
    .single();
  if (error || draft.stripe_session !== session.id)
    throw new Error("Card setup does not match this booking");
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
  if (err)
    throw new Error(
      "Your card was saved, but the trim could not be reserved. No payment was taken. Please choose another time or contact the shop.",
    );
  // Tell the team once the customer has their confirmation, not before.
  after(async () => {
    const { data: made } = await db
      .from("bookings")
      .select("id")
      .eq("group_id", group);
    for (const b of made || [])
      await notifyTrim("new_booking", b.id, {
        title: "New booking",
        lead: "Booked online:",
      });
  });
  return { group, token: signLink("manage", group) };
}
