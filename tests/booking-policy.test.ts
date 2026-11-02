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
  // Written like the trim times on the site ("9:00"), in shop time.
  assert.equal(
    deadlineLabel("2026-09-15", 830, 6),
    "Tue, 15 September 2026 at 7:50",
  );
  assert.equal(
    deadlineLabel("2026-12-15", 600, 24),
    "Mon, 14 December 2026 at 10:00",
  );
  // Eight hours before 8:00 BST on the day the clocks go forward is 23:00 GMT the night before.
  assert.equal(
    deadlineLabel("2026-03-29", 480, 8),
    "Sat, 28 March 2026 at 23:00",
  );
  assert.equal(
    deadlineLabel("2026-09-16", 365, 6),
    "Wed, 16 September 2026 at 0:05",
  );
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
