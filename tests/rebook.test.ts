import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GAP_DAYS,
  daysBetween,
  reminderDue,
  usualGapDays,
} from "../src/lib/rebook-gap.ts";

test("usual gap is the median of the gaps between visits, within two to twelve weeks", () => {
  assert.equal(usualGapDays([]), DEFAULT_GAP_DAYS);
  assert.equal(usualGapDays(["2026-06-01"]), DEFAULT_GAP_DAYS);
  assert.equal(usualGapDays(["2026-06-01", "2026-06-22", "2026-07-13"]), 21);
  // One long summer break does not drag a regular's gap out.
  assert.equal(
    usualGapDays(["2026-03-02", "2026-03-23", "2026-04-13", "2026-07-06"]),
    21,
  );
  assert.equal(usualGapDays(["2026-06-01", "2026-06-05"]), 14);
  assert.equal(usualGapDays(["2026-01-01", "2026-06-01"]), 84);
  // Same-day duplicates (a trim and a beard) count as one visit.
  assert.equal(usualGapDays(["2026-06-01", "2026-06-01", "2026-06-29"]), 28);
});

test("a reminder is due a week past the usual gap and stays due for two weeks", () => {
  assert.equal(daysBetween("2026-06-01", "2026-06-29"), 28);
  assert.equal(reminderDue("2026-06-28", "2026-06-01", 21), false);
  assert.equal(reminderDue("2026-06-29", "2026-06-01", 21), true);
  assert.equal(reminderDue("2026-07-13", "2026-06-01", 21), true);
  assert.equal(reminderDue("2026-07-14", "2026-06-01", 21), false);
});
