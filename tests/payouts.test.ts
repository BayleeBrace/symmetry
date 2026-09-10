import test from "node:test";
import assert from "node:assert/strict";
import {
  computePayout,
  daysInRange,
  mondayOf,
  rentWeeksDue,
  weeksTouched,
} from "../src/lib/payouts-calc.ts";

test("a barber's pay is their card takings less rent, with cash already in their pocket", () => {
  // Self-employed, keeps everything, pays £150 a week for the chair, keeps cash.
  const week = computePayout({
    salesPence: 88000,
    cardPence: 66000,
    cashPence: 22000,
    sharePercent: 100,
    weeklyRentPence: 15000,
    rentWeeks: 1,
    keepsCash: true,
  });
  assert.equal(week.grossPence, 88000);
  assert.equal(week.rentPence, 15000);
  assert.equal(week.cashKeptPence, 22000);
  assert.equal(week.netPence, 51000);

  // A share instead of rent still works.
  const share = computePayout({
    salesPence: 100000,
    cardPence: 70000,
    cashPence: 30000,
    sharePercent: 60,
    weeklyRentPence: 0,
    rentWeeks: 1,
    keepsCash: false,
  });
  assert.equal(share.netPence, 60000);

  // A quiet week can leave the barber owing the shop the rest of the rent.
  const quiet = computePayout({
    salesPence: 8000,
    cardPence: 8000,
    cashPence: 0,
    sharePercent: 100,
    weeklyRentPence: 15000,
    rentWeeks: 1,
    keepsCash: true,
  });
  assert.equal(quiet.netPence, -7000);
});

test("rent is charged once per calendar week, however often the barber is paid", () => {
  assert.equal(mondayOf("2026-09-10"), "2026-09-07");
  assert.equal(mondayOf("2026-09-07"), "2026-09-07");
  assert.equal(mondayOf("2026-09-13"), "2026-09-07");
  assert.deepEqual(weeksTouched("2026-09-07", "2026-09-13"), ["2026-09-07"]);
  assert.deepEqual(weeksTouched("2026-09-10", "2026-09-15"), [
    "2026-09-07",
    "2026-09-14",
  ]);
  assert.equal(daysInRange("2026-09-07", "2026-09-13"), 7);

  // First payout of the week carries the rent.
  assert.equal(rentWeeksDue("2026-09-07", "2026-09-10", []), 1);
  // A second payout later the same week does not.
  assert.equal(
    rentWeeksDue("2026-09-11", "2026-09-13", [
      { period_start: "2026-09-07", period_end: "2026-09-10" },
    ]),
    0,
  );
  // A month carries a week of rent for each week not yet paid.
  assert.equal(
    rentWeeksDue("2026-09-01", "2026-09-30", [
      { period_start: "2026-09-07", period_end: "2026-09-13" },
    ]),
    4,
  );
});
