import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripeMode } from "./card-fees";

/**
 * The shop's card machine and each barber's own Stripe account.
 *
 * One card machine is registered to the shop's Stripe account. A trim paid on
 * it is a destination charge on behalf of that chair's barber: the money
 * settles in the barber's own account, under their name, and Stripe pays it
 * into their bank. Each barber's account carries the barber's id in its
 * metadata, so Stripe is the record of whose account is whose; test and live
 * keys see different accounts, so practice accounts never mix with real ones.
 */
export const BARBER_KEY = "symmetry_barber";

export const cardMode = () => stripeMode(process.env.STRIPE_SECRET_KEY);

/** Thrown for anything the barber can fix or should be told in plain words. */
export class CardError extends Error {}

/** Each barber's Stripe account, by barber id. */
export async function barberAccountIds(stripe: Stripe) {
  const ids = new Map<string, string>();
  for await (const a of stripe.v2.core.accounts.list({ limit: 20 })) {
    const barber = a.metadata?.[BARBER_KEY];
    if (barber && !a.closed && !ids.has(barber)) ids.set(barber, a.id);
    if (ids.size >= 20) break;
  }
  return ids;
}

export type AccountState = {
  id: string;
  /** Can take card payments and be paid: both capabilities active. */
  ready: boolean;
  /** Stripe is waiting on the barber for something. */
  needsDetails: boolean;
};

export async function accountState(
  stripe: Stripe,
  id: string,
): Promise<AccountState> {
  const a = await stripe.v2.core.accounts.retrieve(id, {
    include: [
      "configuration.merchant",
      "configuration.recipient",
      "requirements",
    ],
  });
  const cards = a.configuration?.merchant?.capabilities?.card_payments?.status;
  const transfers =
    a.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers
      ?.status;
  const waiting = (a.requirements?.entries ?? []).some(
    (e) => e.awaiting_action_from === "user",
  );
  const ready = cards === "active" && transfers === "active";
  return { id, ready, needsDetails: waiting || !ready };
}

/** A barber's account, ready to take a payment, or a plain reason why not. */
export async function readyAccount(
  stripe: Stripe,
  barberId: string,
  name: string,
) {
  const id = (await barberAccountIds(stripe)).get(barberId);
  if (!id)
    throw new CardError(
      `${name} hasn’t set up card payments yet. They do it in More, Card payments.`,
    );
  const state = await accountState(stripe, id);
  if (!state.ready)
    throw new CardError(
      `${name}’s card payments aren’t ready yet. They can finish setting up in More, Card payments.`,
    );
  return id;
}

/** Opens a new Stripe account for a barber, paid in their own name. */
export async function createBarberAccount(
  stripe: Stripe,
  barber: { id: string; name: string },
  email: string | undefined,
) {
  const account = await stripe.v2.core.accounts.create(
    {
      display_name: barber.name,
      ...(email ? { contact_email: email } : {}),
      dashboard: "express",
      identity: { country: "gb", entity_type: "individual" },
      defaults: {
        currency: "gbp",
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      configuration: {
        // Merchant: the barber is the seller on their own payments.
        merchant: {
          mcc: "7241",
          capabilities: { card_payments: { requested: true } },
        },
        // Recipient: the shop's account can pass each payment on to them.
        recipient: {
          capabilities: {
            stripe_balance: { stripe_transfers: { requested: true } },
          },
        },
      },
      metadata: { [BARBER_KEY]: barber.id },
    },
    { idempotencyKey: `barber-account-${barber.id}` },
  );
  // Weekly payouts from the start; taking a payment sets it again in case
  // Stripe wasn't ready for it yet.
  await setWeeklyPayouts(stripe, account.id).catch(() => {});
  return account;
}

/** Card takings are paid into each barber's bank once a week, on Mondays (Sean's choice). */
export async function setWeeklyPayouts(stripe: Stripe, account: string) {
  await stripe.balanceSettings.update(
    {
      payments: {
        payouts: {
          schedule: { interval: "weekly", weekly_payout_days: ["monday"] },
        },
      },
    },
    { stripeAccount: account },
  );
}

/**
 * The tip screen on the shop's card machine (Sean's choice): 10, 15 or 20%
 * on a trim of £10 or more, £1, £2 or £3 below that, or no tip. Tips are
 * added to the payment and go to that chair's barber.
 */
export const TIPPING = {
  percentages: [10, 15, 20],
  fixed_amounts: [100, 200, 300],
  smart_tip_threshold: 1000,
};

export async function ensureTipping(
  stripe: Stripe,
  location: Stripe.Terminal.Location,
) {
  if (location.configuration_overrides) {
    await stripe.terminal.configurations.update(
      location.configuration_overrides,
      { tipping: { gbp: TIPPING } },
    );
    return;
  }
  const config = await stripe.terminal.configurations.create({
    tipping: { gbp: TIPPING },
  });
  await stripe.terminal.locations.update(location.id, {
    configuration_overrides: config.id,
  });
}

/** The tip on a card payment, in pence: none when there wasn't one. */
export const tipOf = (pi: Stripe.PaymentIntent) =>
  pi.amount_details?.tip?.amount ?? 0;

/** The shop's card machine: the first one online, else the first one registered. */
export async function shopReader(stripe: Stripe) {
  const { data } = await stripe.terminal.readers.list({ limit: 10 });
  return data.find((r) => r.status === "online") ?? data[0] ?? null;
}

/** The shop's Terminal location, made the first time a machine is added. */
export async function shopLocation(stripe: Stripe) {
  const { data } = await stripe.terminal.locations.list({ limit: 1 });
  if (data[0]) return data[0];
  return stripe.terminal.locations.create(
    {
      display_name: "Symmetry, Saundersfoot",
      address: {
        line1: "4 Brewery Terrace",
        city: "Saundersfoot",
        postal_code: "SA69 9HG",
        country: "GB",
      },
    },
    { idempotencyKey: "shop-location" },
  );
}

/**
 * Marks a trim paid once its card payment has gone through. Safe to call more
 * than once (the checkout screen and Stripe's webhook can both get here): it
 * only changes a trim that is still open and still waiting on this payment.
 */
export async function finishCardPayment(
  db: SupabaseClient,
  pi: Stripe.PaymentIntent,
) {
  if (pi.status !== "succeeded" || pi.metadata?.kind !== "trim") return false;
  const id = pi.metadata.booking;
  if (!id) return false;
  // The price is what the trim cost; a tip on top goes to the barber and
  // isn't counted in sales.
  const tip = tipOf(pi);
  const update: Record<string, unknown> = {
    status: "done",
    paid_by: "card",
    price_pence: pi.amount - tip,
    updated_at: new Date().toISOString(),
  };
  if (pi.metadata.service) update.service_id = pi.metadata.service;
  const { data, error } = await db
    .from("bookings")
    .update(update)
    .eq("id", id)
    .eq("payment_intent", pi.id)
    .in("status", ["booked", "arrived"])
    .select("id,group_id")
    .maybeSingle();
  if (error) throw new Error("Paid, but the diary could not be updated");
  if (!data) return true;
  await db.from("booking_events").insert({
    booking_id: data.id,
    group_id: data.group_id,
    kind: "card_paid",
    actor: pi.metadata.actor || null,
    detail: {
      amount: pi.amount,
      tip,
      fee: pi.application_fee_amount,
      payment_intent: pi.id,
    },
  });
  // One thank-you per trim, two hours later, as for any other checkout.
  await db.from("notification_jobs").upsert(
    {
      dedupe_key: "thanks-" + data.id,
      group_id: data.group_id,
      booking_id: data.id,
      kind: "thanks",
      channel: "email",
      due_at: new Date(Date.now() + 2 * 3600000).toISOString(),
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );
  return true;
}

/** A Stripe error message a barber can act on, or a general one. */
export function cardMessage(e: unknown) {
  if (e instanceof CardError) return e.message;
  const err = e as { code?: string; message?: string; type?: string };
  if (err?.code === "terminal_reader_busy")
    return "The card machine is busy with another payment. Cancel that one on the machine or here, then try again.";
  if (err?.code === "terminal_reader_offline")
    return "The card machine is offline. Check it’s on and connected to the Wi-Fi.";
  if (err?.type === "StripeCardError" && err.message) return err.message;
  return "";
}
