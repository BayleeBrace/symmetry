/**
 * What a card payment costs, and what the barber is left with. Plain maths,
 * so it can be checked in tests without Stripe.
 *
 * The shop's Stripe account pays Stripe for every payment, then takes the
 * same amount back from the barber's share as an application fee, so each
 * barber pays their own card fees, as on Fresha:
 *
 *   card machine   1.4% + 10p  (Stripe's UK in-person price, UK and EEA cards)
 *   saved card     1.5% + 20p  (Stripe's UK online price; no-show fees)
 *   splitting      0.25%       (Connect's charge for paying it on to the barber)
 *
 * Connect's 10p a payout and £2 a month per barber are billed to the shop and
 * are not in here: who covers them is the owner's choice.
 */
export const IN_PERSON = { percent: 1.4, fixedPence: 10 };
export const ONLINE = { percent: 1.5, fixedPence: 20 };
export const SPLIT_PERCENT = 0.25;

/** The smallest card payment Stripe takes in pounds: 30p. */
export const MIN_CARD_PENCE = 30;

/** The fee kept back from a payment of `amountPence`, in pence. */
export function cardFee(amountPence: number, kind: "in_person" | "online") {
  const rate = kind === "online" ? ONLINE : IN_PERSON;
  return (
    Math.round((amountPence * (rate.percent + SPLIT_PERCENT)) / 100) +
    rate.fixedPence
  );
}

/** What reaches the barber from a payment, after the card fee. */
export function barberGets(amountPence: number, kind: "in_person" | "online") {
  return amountPence - cardFee(amountPence, kind);
}

/** "test" with Stripe's test keys, "live" with real ones, null when Stripe is not connected. */
export function stripeMode(key: string | undefined) {
  if (!key) return null;
  return /^(sk|rk)_test_/.test(key) ? "test" : "live";
}
