import test from "node:test";
import assert from "node:assert/strict";
import { barberGets, cardFee, stripeMode } from "../src/lib/card-fees.ts";
import { computePayout } from "../src/lib/payouts-calc.ts";

test("card fees: a £20 trim on the card machine costs 43p, so the barber gets £19.57", () => {
  // 1.4% + 10p for the card, 0.25% for passing it on to the barber.
  assert.equal(cardFee(2000, "in_person"), 43);
  assert.equal(barberGets(2000, "in_person"), 1957);
  assert.equal(cardFee(2700, "in_person"), 55);
});

test("card fees: a no-show fee on a saved card is priced as an online payment", () => {
  // 1.5% + 20p, plus the 0.25%.
  assert.equal(cardFee(2400, "online"), 62);
  assert.equal(cardFee(500, "online"), 29);
  assert.ok(cardFee(500, "online") < 500);
});

test("card fees: test keys mean practice mode, real keys mean live", () => {
  assert.equal(stripeMode(undefined), null);
  assert.equal(stripeMode(""), null);
  assert.equal(stripeMode("sk_test_abc"), "test");
  assert.equal(stripeMode("rk_test_abc"), "test");
  assert.equal(stripeMode("sk_live_abc"), "live");
  assert.equal(stripeMode("rk_live_abc"), "live");
});

test("payouts: card machine takings are already in the barber's bank, so the shop owes only the rest", () => {
  // £300 of trims: £200 on the card machine (paid by Stripe), £100 cash kept. £80 rent.
  const week = computePayout({
    salesPence: 30000,
    cardPence: 20000,
    cashPence: 10000,
    sharePercent: 100,
    weeklyRentPence: 8000,
    rentWeeks: 1,
    keepsCash: true,
    directPence: 20000,
  });
  assert.equal(week.directPence, 20000);
  // Nothing left for the shop to transfer: the barber owes the week's rent.
  assert.equal(week.netPence, -8000);
});

test("payouts: without card machine takings nothing changes", () => {
  const week = computePayout({
    salesPence: 30000,
    cardPence: 20000,
    cashPence: 10000,
    sharePercent: 100,
    weeklyRentPence: 8000,
    rentWeeks: 1,
    keepsCash: true,
  });
  assert.equal(week.directPence, 0);
  assert.equal(week.netPence, 12000);
});
