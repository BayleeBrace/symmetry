import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  clock,
  isOpen,
  makeSlots,
  money,
  SERVICES,
  shopToday,
} from "../src/lib/booking-data.ts";

test("shop hours and date arithmetic remain stable", () => {
  assert.equal(addDays("2026-09-29", 7), "2026-10-06");
  assert.equal(isOpen("2026-09-08"), true);
  assert.equal(isOpen("2026-09-07"), false);
});

let nextTuesday = addDays(shopToday(), 1);
while (new Date(nextTuesday + "T12:00:00Z").getUTCDay() !== 2)
  nextTuesday = addDays(nextTuesday, 1);

test("any barber exposes exact barber-specific time, price and duration", () => {
  const slots = makeSlots(nextTuesday, "any", "fade", []);
  assert(
    slots.some(
      (slot) =>
        slot.barber === "dylan" &&
        slot.time === 540 &&
        slot.price === 17 &&
        slot.duration === 50,
    ),
  );
  assert(
    slots.some(
      (slot) =>
        slot.barber === "sean" && slot.price === 24 && slot.duration === 40,
    ),
  );
});

test("busy periods remove every overlapping start", () => {
  const slots = makeSlots(nextTuesday, "sean", "cut", [
    { barber: "sean", start: 570, duration: 30 },
  ]);
  assert(!slots.some((slot) => slot.time === 555));
  assert(!slots.some((slot) => slot.time === 570));
  assert(slots.some((slot) => slot.time === 600));
});

test("canonical prices preserve fifty pence services", () => {
  const under16 = SERVICES.find((service) => service.id === "under-16")!;
  assert.equal(money(under16.barbers.sean.price), "18.50");
  assert.equal(clock(665), "11:05");
});
