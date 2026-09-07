import "server-only";
import Stripe from "stripe";
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new Error("Card setup is not connected");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
