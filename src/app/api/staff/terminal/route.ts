import { z } from "zod";
import type Stripe from "stripe";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/stripe";
import { shopMinute, shopToday } from "@/lib/booking-data";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
import { MIN_CARD_PENCE, barberGets, cardFee } from "@/lib/card-fees";
import {
  CardError,
  cardMessage,
  cardMode,
  finishCardPayment,
  readyAccount,
  shopReader,
} from "@/lib/card-payments";

/**
 * Taking a trim's payment on the shop's card machine.
 *
 * start     sends the price to the machine (a payment on behalf of the chair's barber)
 * check     what's happened: waiting, paid, or declined with the reason
 * simulate  practice mode only: a pretend card tapped on the pretend machine
 * cancel    stops the machine waiting and drops the payment
 * refund    owner only: gives a card-machine payment back in full
 */
const actions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    id: z.uuid(),
    service: z.uuid().optional(),
    price_pence: z.number().int().min(MIN_CARD_PENCE).max(100000),
  }),
  z.object({ action: z.literal("check"), id: z.uuid() }),
  z.object({
    action: z.literal("simulate"),
    id: z.uuid(),
    card: z.enum(["ok", "declined"]).default("ok"),
  }),
  z.object({ action: z.literal("cancel"), id: z.uuid() }),
  z.object({ action: z.literal("refund"), id: z.uuid() }),
]);

/** Test cards Stripe's pretend machine understands. */
const TEST_CARD = { ok: "4242424242424242", declined: "4000000000009995" };

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff();
    const p = actions.parse(await req.json());
    const mode = cardMode();
    if (!mode) throw new CardError("Stripe isn’t connected yet");
    const stripe = stripeClient();
    const db = createAdminClient();
    const { data: b } = await db
      .from("bookings")
      .select(
        "id,group_id,status,local_date,start_minute,price_pence,service_id,barber_id,payment_intent,paid_by,services(name),barbers(name)",
      )
      .eq("id", p.id)
      .single();
    if (!b) throw new CardError("This trim is not in the diary");
    const barberName =
      (b.barbers as unknown as { name: string } | null)?.name ?? "This barber";
    const open = ["booked", "arrived"].includes(b.status);

    if (p.action === "refund") {
      if (staff.role !== "owner")
        throw new CardError("Only the owner can give refunds");
      if (
        b.status !== "done" ||
        b.paid_by !== "card" ||
        !b.payment_intent ||
        b.price_pence <= 0
      )
        throw new CardError(
          "Only a trim paid on the card machine can be refunded here",
        );
      const pi = await stripe.paymentIntents.retrieve(b.payment_intent);
      if (
        pi.metadata?.kind !== "trim" ||
        pi.metadata.booking !== b.id ||
        pi.status !== "succeeded"
      )
        throw new CardError(
          "This payment can’t be refunded from the app. Use the Stripe dashboard.",
        );
      // The barber's share comes back from their account, and the card fee with it.
      await stripe.refunds.create(
        {
          payment_intent: pi.id,
          reverse_transfer: true,
          refund_application_fee: true,
        },
        { idempotencyKey: "refund-" + b.id },
      );
      const { error } = await db
        .from("bookings")
        .update({ price_pence: 0, updated_at: new Date().toISOString() })
        .eq("id", b.id)
        .eq("payment_intent", pi.id);
      if (error)
        throw new Error("Refunded in Stripe. Refresh to see it in the diary.");
      await db.from("booking_events").insert({
        booking_id: b.id,
        group_id: b.group_id,
        kind: "card_refunded",
        actor: staff.user_id,
        detail: { amount: pi.amount, payment_intent: pi.id },
      });
      return privateJson({ ok: true, amount: pi.amount });
    }

    const reader = await shopReader(stripe);

    if (p.action === "start") {
      if (!open) throw new CardError("This trim is already closed");
      if (
        b.local_date > shopToday() ||
        (b.local_date === shopToday() && b.start_minute > shopMinute())
      )
        throw new CardError("This trim has not started yet");
      if (!reader)
        throw new CardError(
          mode === "test"
            ? "There’s no practice card machine yet. The owner adds one in More, Card payments."
            : "The card machine isn’t set up yet. The owner adds it in More, Card payments.",
        );
      let service = b.service_id as string;
      let serviceName =
        (b.services as unknown as { name: string } | null)?.name ?? "Trim";
      if (p.service && p.service !== b.service_id) {
        const [{ data: price }, { data: s }] = await Promise.all([
          db
            .from("service_prices")
            .select("price_pence")
            .eq("barber_id", b.barber_id)
            .eq("service_id", p.service)
            .eq("active", true)
            .maybeSingle(),
          db.from("services").select("name").eq("id", p.service).maybeSingle(),
        ]);
        if (!price || !s)
          throw new CardError("That service has no price on this chair");
        service = p.service;
        serviceName = s.name;
      }
      const account = await readyAccount(stripe, b.barber_id, barberName);
      // A payment already waiting for this trim at the same price is reused,
      // so a second tap or a retry after a decline never charges twice.
      let pi: Stripe.PaymentIntent | null = null;
      if (b.payment_intent) {
        const old = await stripe.paymentIntents.retrieve(b.payment_intent);
        if (old.metadata?.kind === "trim" && old.status === "succeeded") {
          await finishCardPayment(db, old);
          return privateJson({ status: "paid", amount: old.amount });
        }
        // The bank is still deciding on the last tap: never start a second payment over it.
        if (old.metadata?.kind === "trim" && old.status === "processing")
          return privateJson({ status: "waiting", practice: mode === "test" });
        if (
          old.metadata?.kind === "trim" &&
          old.amount === p.price_pence &&
          old.metadata.service === service &&
          ["requires_payment_method", "requires_confirmation"].includes(
            old.status,
          )
        )
          pi = old;
        else if (old.metadata?.kind === "trim" && old.status !== "canceled")
          await stripe.paymentIntents.cancel(old.id).catch(() => {});
      }
      if (!pi) {
        pi = await stripe.paymentIntents.create({
          amount: p.price_pence,
          currency: "gbp",
          allowed_payment_method_types: ["card_present"],
          capture_method: "automatic",
          // Settles in the barber's own account, as the seller, and pays out to their bank.
          on_behalf_of: account,
          transfer_data: { destination: account },
          application_fee_amount: cardFee(p.price_pence, "in_person"),
          description: `${serviceName} with ${barberName}`,
          metadata: {
            kind: "trim",
            booking: b.id,
            barber: b.barber_id,
            service,
            actor: staff.user_id,
          },
        });
        // Recorded on the trim before the machine is asked, so nothing is ever charged off the books.
        const claim = db
          .from("bookings")
          .update({ payment_intent: pi.id })
          .eq("id", b.id)
          .in("status", ["booked", "arrived"]);
        const { data: claimed } = await (
          b.payment_intent
            ? claim.eq("payment_intent", b.payment_intent)
            : claim.is("payment_intent", null)
        )
          .select("id")
          .maybeSingle();
        if (!claimed) {
          await stripe.paymentIntents.cancel(pi.id).catch(() => {});
          throw new CardError(
            "Someone else is taking this payment. Refresh the diary.",
          );
        }
      }
      await stripe.terminal.readers.processPaymentIntent(reader.id, {
        payment_intent: pi.id,
      });
      return privateJson({
        status: "waiting",
        amount: pi.amount,
        barber_gets: barberGets(pi.amount, "in_person"),
        practice: mode === "test",
      });
    }

    if (!b.payment_intent) {
      if (b.status === "done" && b.paid_by === "card")
        return privateJson({ status: "paid" });
      throw new CardError("No card payment has been started for this trim");
    }
    const pi = await stripe.paymentIntents.retrieve(b.payment_intent);
    if (pi.metadata?.kind !== "trim")
      throw new CardError("This trim’s payment isn’t a card machine payment");

    if (p.action === "simulate") {
      if (mode !== "test")
        throw new CardError(
          "Only the practice card machine can be tapped from here",
        );
      if (!reader) throw new CardError("There’s no practice card machine");
      await stripe.testHelpers.terminal.readers.presentPaymentMethod(
        reader.id,
        {
          type: "card_present",
          card_present: { number: TEST_CARD[p.card] },
        },
      );
    }

    if (p.action === "cancel") {
      if (pi.status === "succeeded") {
        await finishCardPayment(db, pi);
        return privateJson({ status: "paid", amount: pi.amount });
      }
      // Only stop the machine if it's this trim it's waiting on: another
      // barber's payment on the same machine is left alone.
      if (reader) {
        const machine = await stripe.terminal.readers.retrieve(reader.id);
        const waitingOn =
          !("deleted" in machine) &&
          machine.action?.process_payment_intent?.payment_intent;
        if (waitingOn === pi.id)
          await stripe.terminal.readers.cancelAction(reader.id).catch(() => {});
      }
      if (pi.status !== "canceled")
        await stripe.paymentIntents.cancel(pi.id).catch(() => {});
      await db
        .from("bookings")
        .update({ payment_intent: null })
        .eq("id", b.id)
        .eq("payment_intent", pi.id)
        .in("status", ["booked", "arrived"]);
      return privateJson({ status: "cancelled" });
    }

    // check (and the moment after a simulated tap)
    const now = await stripe.paymentIntents.retrieve(pi.id);
    if (now.status === "succeeded") {
      await finishCardPayment(db, now);
      return privateJson({
        status: "paid",
        amount: now.amount,
        barber_gets: barberGets(now.amount, "in_person"),
      });
    }
    if (now.status === "canceled") return privateJson({ status: "cancelled" });
    const machine = reader
      ? await stripe.terminal.readers.retrieve(reader.id)
      : null;
    const action = machine && !("deleted" in machine) ? machine.action : null;
    const forThis = action?.process_payment_intent?.payment_intent === now.id;
    if (forThis && action?.status === "failed")
      return privateJson({
        status: "failed",
        message:
          now.last_payment_error?.message ||
          action.failure_message ||
          "The card didn’t go through.",
      });
    if (
      now.last_payment_error &&
      (!forThis || action?.status !== "in_progress")
    )
      return privateJson({
        status: "failed",
        message: now.last_payment_error.message || "The card was declined.",
      });
    return privateJson({ status: "waiting", practice: mode === "test" });
  } catch (e) {
    return publicError(new Error(cardMessage(e) || (e as Error).message), 409);
  }
}
