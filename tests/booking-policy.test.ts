import assert from "node:assert/strict";
import test from "node:test";
import {
  shopInstant,
  cancellationDeadline,
  deadlineLabel,
} from "../src/lib/booking-policy.ts";
import { cancellationFee } from "../src/lib/booking-data.ts";
test("summer and winter booking instants use London time", () => {
  assert.equal(
    shopInstant("2026-09-15", 830).toISOString(),
    "2026-09-15T12:50:00.000Z",
  );
  assert.equal(
    shopInstant("2026-12-15", 830).toISOString(),
    "2026-12-15T13:50:00.000Z",
  );
});
test("six-hour deadline matches the supplied booking and crosses DST correctly", () => {
  assert.equal(
    cancellationDeadline("2026-09-15", 830, 6).toISOString(),
    "2026-09-15T06:50:00.000Z",
  );
  assert.match(deadlineLabel("2026-09-15", 830, 6), /07:50/);
  assert.equal(
    cancellationDeadline("2026-10-25", 480, 8).toISOString(),
    "2026-10-25T00:00:00.000Z",
  );
  assert.equal(
    cancellationDeadline("2026-03-29", 480, 8).toISOString(),
    "2026-03-28T23:00:00.000Z",
  );
});
test("fees use each trim price and the accepted percentages", () => {
  assert.equal(cancellationFee(2400, "late"), 1200);
  assert.equal(cancellationFee(1850, "late"), 925);
  assert.equal(cancellationFee(1550, "no_show"), 1550);
  assert.equal(cancellationFee(2400, "late", 25), 600);
});
