import { stripeClient } from "@/lib/stripe";
import { finalizeBooking } from "@/lib/finalize-booking";
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
    try {
      await finalizeBooking(event.data.object.id);
    } catch {
      return new Response("Unable to finalize booking", { status: 500 });
    }
  }
  return Response.json({ received: true });
}
