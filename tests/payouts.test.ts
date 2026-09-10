import test from "node:test";
import assert from "node:assert/strict";
import {
  computePayout,
  daysInRange,
  weeksIn,
} from "../src/lib/payouts-calc.ts";

test("a barber's pay is their share, less rent per week, less cash they already hold", () => {
  const week = computePayout({
    salesPence: 100000,
    cardPence: 70000,
    cashPence: 30000,
    sharePercent: 60,
    weeklyRentPence: 0,
    keepsCash: false,
    days: 7,
  });
  assert.equal(week.grossPence, 60000);
  assert.equal(week.netPence, 60000);

  const rentAndCash = computePayout({
    salesPence: 100000,
    cardPence: 70000,
    cashPence: 30000,
    sharePercent: 100,
    weeklyRentPence: 15000,
    keepsCash: true,
    days: 7,
  });
  assert.equal(rentAndCash.rentPence, 15000);
  assert.equal(rentAndCash.cashKeptPence, 30000);
  assert.equal(rentAndCash.netPence, 55000);

  // A quiet week with rent can leave the barber owing the shop.
  const quiet = computePayout({
    salesPence: 8000,
    cardPence: 8000,
    cashPence: 0,
    sharePercent: 100,
    weeklyRentPence: 15000,
    keepsCash: false,
    days: 4,
  });
  assert.equal(quiet.netPence, -7000);
});

test("rent is charged once per week of the period, part weeks included", () => {
  assert.equal(weeksIn(1), 1);
  assert.equal(weeksIn(7), 1);
  assert.equal(weeksIn(10), 1);
  assert.equal(weeksIn(14), 2);
  assert.equal(weeksIn(30), 4);
  assert.equal(daysInRange("2026-09-07", "2026-09-13"), 7);
  assert.equal(daysInRange("2026-09-10", "2026-09-10"), 1);
});
