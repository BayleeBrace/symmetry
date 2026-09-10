import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryLimiter } from "../src/lib/memory-rate-limit.ts";
import { openingStatus } from "../src/lib/opening-status.ts";
import { OPENING_HOURS } from "../src/lib/booking-data.ts";
test("preview limiter limits each scope/IP and releases expired windows", () => {
  const take = createMemoryLimiter(2);
  assert.equal(take("a", 2, 10, 0), true);
  assert.equal(take("a", 2, 10, 1000), true);
  assert.equal(take("a", 2, 10, 2000), false);
  assert.equal(take("b", 2, 10, 2000), true);
  assert.equal(take("c", 2, 10, 3000), false);
  assert.equal(take("a", 2, 10, 10000), true);
  assert.equal(take("c", 2, 10, 20001), true);
});
test("next open uses London time and handles closing time and closed days", () => {
  assert.equal(
    openingStatus(OPENING_HOURS, new Date("2026-09-08T08:00:00Z")),
    "Open today until 6pm.",
  );
  assert.equal(
    openingStatus(OPENING_HOURS, new Date("2026-09-08T17:00:00Z")),
    "Next open tomorrow at 11am.",
  );
  assert.equal(
    openingStatus(OPENING_HOURS, new Date("2026-09-06T20:00:00Z")),
    "Next open Tuesday at 9am.",
  );
  assert.equal(
    openingStatus(OPENING_HOURS, new Date("2026-12-08T08:30:00Z")),
    "Next open today at 9am.",
  );
});

import { showFormerly } from "../src/lib/brand-copy.ts";
import { clock, inputTime, hourWord } from "../src/lib/booking-data.ts";
test("brand date cutoff uses the shop timezone and machine time stays padded", () => {
  assert.equal(
    showFormerly("2026-09-08", new Date("2026-09-07T22:59:00Z")),
    true,
  );
  assert.equal(
    showFormerly("2026-09-08", new Date("2026-09-07T23:00:00Z")),
    false,
  );
  assert.equal(clock(540), "9:00");
  assert.equal(inputTime(540), "09:00");
  assert.equal(hourWord(540), "9am");
  assert.equal(hourWord(1080), "6pm");
  assert.equal(hourWord(1110), "6:30pm");
});
