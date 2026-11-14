import { z } from "zod";
import type Stripe from "stripe";
import { requireStaff } from "@/lib/staff";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient } from "@/lib/stripe";
import { sameOrigin, privateJson, publicError } from "@/lib/security";
import {
  CardError,
  accountState,
  barberAccountIds,
  cardMessage,
  cardMode,
  ensureTipping,
  isPretend,
  shopLocation,
  shopReader,
} from "@/lib/card-payments";
import { onboardingLink } from "@/lib/card-onboarding";
import { MIN_CARD_PENCE } from "@/lib/card-fees";
import { addTestCards } from "@/lib/test-data";

/**
 * Card payments set-up: whether Stripe is connected and in practice mode, the
 * shop's card machine, and each barber's own account. Everyone sees the
 * machine and their own chair; the owner sees every chair.
 */
export async function GET() {
  try {
    const staff = await requireStaff();
    const mode = cardMode();
    if (!mode) return privateJson({ mode: null });
    const stripe = stripeClient();
    const db = createAdminClient();
    const owner = staff.role === "owner";
    const [{ data: barbers }, ids, reader] = await Promise.all([
      db
        .from("barbers")
        .select("id,name,display_order")
        .eq("active", true)
        .order("display_order"),
      barberAccountIds(stripe),
      shopReader(stripe),
    ]);
    const chairs = (barbers ?? []).filter(
      (b) => owner || b.id === staff.barber_id,
    );
    const rows = await Promise.all(
      chairs.map(async (b) => {
        const id = ids.get(b.id);
        const state = id ? await accountState(stripe, id) : null;
        return {
          id: b.id,
          name: b.name,
          mine: b.id === staff.barber_id,
          started: Boolean(id),
          ready: state?.ready ?? false,
          needs_details: state?.needsDetails ?? true,
        };
      }),
    );
    return privateJson({
      mode,
      owner,
      reader: reader
        ? {
            label: reader.label,
            status: reader.status,
            simulated: reader.device_type.startsWith("simulated"),
          }
        : null,
      barbers: rows,
    });
  } catch (e) {
    return publicError(new Error(cardMessage(e) || (e as Error).message), 409);
  }
}

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("onboard"), barber: z.uuid() }),
  z.object({ action: z.literal("dashboard") }),
  z.object({
    action: z.literal("add_reader"),
    // The words a real machine shows when it's ready to register. Without
    // them, practice mode makes a pretend one.
    code: z.string().trim().min(3).max(60).optional(),
  }),
  z.object({ action: z.literal("remove_reader") }),
  // A 30p test on the real machine, paid to the shop and refunded at once.
  z.object({ action: z.literal("test_payment") }),
  z.object({
    action: z.literal("test_check"),
    id: z.string().startsWith("pi_"),
  }),
  z.object({
    action: z.literal("test_cancel"),
    id: z.string().startsWith("pi_"),
  }),
]);

/** Refunds a finished machine test once, and says which card it was. */
async function refundTest(stripe: Stripe, pi: Stripe.PaymentIntent) {
  const { data } = await stripe.refunds.list({
    payment_intent: pi.id,
    limit: 1,
  });
  if (!data.length)
    await stripe.refunds.create(
      { payment_intent: pi.id, metadata: { kind: "machine_test" } },
      { idempotencyKey: `machine-test-refund-${pi.id}` },
    );
  const charge =
    typeof pi.latest_charge === "string"
      ? await stripe.charges.retrieve(pi.latest_charge)
      : pi.latest_charge;
  const card = charge?.payment_method_details?.card_present;
  return privateJson({
    status: "refunded",
    amount: pi.amount,
    card: card?.last4
      ? `${card.brand ? card.brand[0].toUpperCase() + card.brand.slice(1) : "Card"} ending ${card.last4}`
      : null,
  });
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const staff = await requireStaff();
    const p = actions.parse(await req.json());
    const mode = cardMode();
    if (!mode) throw new CardError("Stripe isn’t connected yet");
    const stripe = stripeClient();
    const db = createAdminClient();
    if (p.action === "onboard")
      return privateJson({
        url: await onboardingLink(stripe, db, staff, p.barber),
      });
    if (p.action === "dashboard") {
      if (!staff.barber_id) throw new CardError("Your sign-in has no chair");
      const id = (await barberAccountIds(stripe)).get(staff.barber_id);
      if (!id) throw new CardError("Set up card payments first");
      try {
        const link = await stripe.accounts.createLoginLink(id);
        return privateJson({ url: link.url });
      } catch {
        throw new CardError(
          "Finish setting up with Stripe first, then your payouts appear here.",
        );
      }
    }
    if (staff.role !== "owner")
      throw new CardError("Only the owner can change the card machine");
    if (p.action === "remove_reader") {
      // Frees the machine so it can be registered elsewhere, such as on the
      // live account at switch-over. A practice machine goes the same way.
      const { data } = await stripe.terminal.readers.list({ limit: 10 });
      for (const r of data) await stripe.terminal.readers.del(r.id);
      return privateJson({ ok: true, removed: data.length });
    }
    if (p.action === "test_payment") {
      const reader = await shopReader(stripe);
      if (!reader || isPretend(reader))
        throw new CardError("Register the shop’s card machine first");
      // No barber: it settles in the shop's own account and is refunded once it's through.
      const pi = await stripe.paymentIntents.create({
        amount: MIN_CARD_PENCE,
        currency: "gbp",
        allowed_payment_method_types: ["card_present"],
        capture_method: "automatic",
        description: "Card machine test, refunded straight away",
        metadata: { kind: "machine_test", actor: staff.user_id },
      });
      await stripe.terminal.readers.processPaymentIntent(reader.id, {
        payment_intent: pi.id,
        process_config: { skip_tipping: true },
      });
      return privateJson({ status: "waiting", id: pi.id, amount: pi.amount });
    }
    if (p.action === "test_check" || p.action === "test_cancel") {
      const pi = await stripe.paymentIntents.retrieve(p.id);
      if (pi.metadata?.kind !== "machine_test")
        throw new CardError("That isn’t a card machine test");
      if (pi.status === "succeeded") return refundTest(stripe, pi);
      if (pi.status === "canceled") return privateJson({ status: "cancelled" });
      const reader = await shopReader(stripe);
      const action = reader?.action;
      const forThis = action?.process_payment_intent?.payment_intent === pi.id;
      if (p.action === "test_cancel") {
        if (reader && forThis)
          await stripe.terminal.readers.cancelAction(reader.id).catch(() => {});
        const now = await stripe.paymentIntents.retrieve(pi.id);
        // The card went through just as Cancel was tapped: give it back.
        if (now.status === "succeeded") return refundTest(stripe, now);
        if (now.status !== "canceled")
          await stripe.paymentIntents.cancel(now.id).catch(() => {});
        return privateJson({ status: "cancelled" });
      }
      if (forThis && action?.status === "failed")
        return privateJson({
          status: "failed",
          message:
            pi.last_payment_error?.message ||
            action.failure_message ||
            "The card didn’t go through.",
        });
      if (
        pi.last_payment_error &&
        (!forThis || action?.status !== "in_progress")
      )
        return privateJson({
          status: "failed",
          message: pi.last_payment_error.message || "The card was declined.",
        });
      return privateJson({ status: "waiting", id: pi.id });
    }
    if (mode === "live" && !p.code)
      throw new CardError("Type the words shown on the card machine’s screen");
    const location = await shopLocation(stripe);
    // The tip screen on every payment, as Sean chose.
    await ensureTipping(stripe, location);
    const real = Boolean(p.code);
    const reader = await stripe.terminal.readers.create({
      // Practice without words: a pretend BBPOS WisePOS E, the shop’s model.
      registration_code: real ? p.code! : "simulated-wpe",
      label: !real
        ? "Practice card machine"
        : mode === "test"
          ? "Shop card machine (practice)"
          : "Shop card machine",
      location: location.id,
    });
    // One machine at a time: the real one replaces a pretend one.
    if (real) {
      const { data } = await stripe.terminal.readers.list({ limit: 10 });
      for (const r of data)
        if (r.id !== reader.id && isPretend(r))
          await stripe.terminal.readers.del(r.id).catch(() => {});
    }
    // Test clients added before Stripe was connected get their test cards now.
    if (mode === "test") await addTestCards(stripe).catch(() => 0);
    return privateJson({ ok: true, label: reader.label });
  } catch (e) {
    return publicError(new Error(cardMessage(e) || (e as Error).message), 409);
  }
}
