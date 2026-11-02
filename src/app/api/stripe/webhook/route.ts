import { stripeClient } from "@/lib/stripe";
import { finalizeBooking, PermanentBookingError } from "@/lib/finalize-booking";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET)
    return new Response("Invalid signature", { status: 400 });
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (
    event.type === "checkout.session.completed" &&
    event.data.object.mode === "setup"
  ) {
    const session = event.data.object;
    try {
      await finalizeBooking(session.id);
    } catch (e) {
      // Only a passing problem (Stripe or the database not answering) is
      // worth Stripe trying again. A setup that can never become a booking
      // is recorded and acknowledged, so Stripe stops retrying it.
      if (!(e instanceof PermanentBookingError))
        return new Response("Unable to finalize booking", { status: 500 });
      console.error("Card setup not booked", session.id, e.message);
      try {
        await createAdminClient()
          .from("booking_events")
          .insert({
            kind: "card_setup_failed",
            detail: {
              session: session.id,
              attempt: session.metadata?.attempt ?? null,
              reason: e.message,
            },
          });
      } catch {}
      return Response.json({ received: true, booked: false });
    }
  }
  return Response.json({ received: true });
}
