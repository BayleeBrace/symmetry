import test from "node:test";
import assert from "node:assert/strict";
import { estimateWait } from "../src/lib/walk-in.ts";
import {
  encodeRemembered,
  readRemembered,
} from "../src/lib/remembered-details.ts";

const open: [number, number] = [540, 1080]; // 9am to 6pm

test("walk-in wait: closed outside opening hours", () => {
  const durations = { sean: 30 };
  assert.deepEqual(
    estimateWait({ minute: 600, hours: null, busy: [], durations }),
    { state: "closed" },
  );
  assert.deepEqual(
    estimateWait({ minute: 500, hours: open, busy: [], durations }),
    { state: "closed" },
  );
  assert.deepEqual(
    estimateWait({ minute: 1080, hours: open, busy: [], durations }),
    { state: "closed" },
  );
});

test("walk-in wait: free, a short wait, or a time later", () => {
  // Nobody in the chair.
  assert.deepEqual(
    estimateWait({
      minute: 610,
      hours: open,
      busy: [],
      durations: { sean: 30 },
    }),
    { state: "free" },
  );
  // Sean busy until 10:40, Travis until 10:25: Travis is sooner, 15 minutes.
  assert.deepEqual(
    estimateWait({
      minute: 610,
      hours: open,
      busy: [
        { barber: "sean", start: 600, duration: 40 },
        { barber: "travis", start: 595, duration: 30 },
      ],
      durations: { sean: 30, travis: 30 },
    }),
    { state: "wait", minutes: 15 },
  );
  // Three minutes rounds up to five, which counts as free.
  assert.deepEqual(
    estimateWait({
      minute: 610,
      hours: open,
      busy: [{ barber: "sean", start: 590, duration: 23 }],
      durations: { sean: 30 },
    }),
    { state: "free" },
  );
  // Busy for an hour and a half: say when instead of how long.
  assert.deepEqual(
    estimateWait({
      minute: 610,
      hours: open,
      busy: [{ barber: "sean", start: 600, duration: 100 }],
      durations: { sean: 30 },
    }),
    { state: "later", at: 700 },
  );
});

test("walk-in wait: gaps too short, own hours and running behind", () => {
  // A 20-minute gap is too short for a 30-minute cut; the next space is 11:30.
  assert.deepEqual(
    estimateWait({
      minute: 600,
      hours: open,
      busy: [
        { barber: "sean", start: 600, duration: 20 },
        { barber: "sean", start: 640, duration: 50 },
      ],
      durations: { sean: 30 },
    }),
    { state: "later", at: 690 },
  );
  // Starts at 11am on his own hours: an hour's wait at 10am.
  assert.deepEqual(
    estimateWait({
      minute: 600,
      hours: open,
      busy: [{ barber: "dylan", start: 0, duration: 660 }],
      durations: { dylan: 35 },
    }),
    { state: "wait", minutes: 60 },
  );
  // Running 20 minutes behind with nothing booked.
  assert.deepEqual(
    estimateWait({
      minute: 600,
      hours: open,
      busy: [],
      durations: { sean: 30 },
      delays: { sean: 20 },
    }),
    { state: "wait", minutes: 20 },
  );
  // Booked up to closing: no walk-in space left today.
  assert.deepEqual(
    estimateWait({
      minute: 1000,
      hours: open,
      busy: [{ barber: "sean", start: 990, duration: 70 }],
      durations: { sean: 30 },
    }),
    { state: "full" },
  );
  // Not working today at all.
  assert.deepEqual(
    estimateWait({
      minute: 600,
      hours: open,
      busy: [{ barber: "travis", start: 0, duration: 1440 }],
      durations: { travis: 30 },
    }),
    { state: "full" },
  );
});

test("remembered details: round trip, expiry and bad data", () => {
  const details = {
    name: "Sam Jones",
    email: "sam@example.com",
    country: "GB",
    phone: "07400 123456",
  };
  const now = Date.UTC(2026, 10, 2);
  const saved = encodeRemembered(details, now);
  assert.deepEqual(readRemembered(saved, now), details);
  // Nothing else is kept, even if passed in.
  assert.equal(
    JSON.parse(
      encodeRemembered({ ...details, marketing: true } as typeof details, now),
    ).marketing,
    undefined,
  );
  assert.equal(readRemembered(saved, now + 366 * 86400000), null);
  assert.equal(readRemembered(null), null);
  assert.equal(readRemembered("not json"), null);
  assert.equal(
    readRemembered(
      JSON.stringify({ v: 1, savedAt: now, ...details, country: "gb" }),
      now,
    ),
    null,
  );
  assert.equal(
    readRemembered(
      JSON.stringify({ v: 1, savedAt: now, ...details, name: "x".repeat(101) }),
      now,
    ),
    null,
  );
});
