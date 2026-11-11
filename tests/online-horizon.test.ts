import test from "node:test";
import assert from "node:assert/strict";
import { onlineHorizon } from "../src/lib/booking-data.ts";

test("online booking: clients can book up to two months ahead", () => {
  assert.equal(onlineHorizon("2026-11-11"), "2027-01-11");
  assert.equal(onlineHorizon("2026-01-15"), "2026-03-15");
});

test("online booking: a short month ends the window on its last day", () => {
  assert.equal(onlineHorizon("2026-12-31"), "2027-02-28");
  assert.equal(onlineHorizon("2027-12-31"), "2028-02-29");
  assert.equal(onlineHorizon("2026-08-31"), "2026-10-31");
});
