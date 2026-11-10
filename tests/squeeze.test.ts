import test from "node:test";
import assert from "node:assert/strict";
import {
  clashes,
  soonestStart,
  squeezeStart,
  startChoices,
} from "../src/lib/squeeze.ts";

test("squeeze: a walk-in can start in the next five minutes, never a time that's gone", () => {
  assert.equal(soonestStart(10 * 60 + 38), 10 * 60 + 40);
  // On the dot: that minute has already started, so the next mark.
  assert.equal(soonestStart(10 * 60 + 40), 10 * 60 + 45);
});

test("squeeze: today's times start from now and include the soonest start", () => {
  const choices = startChoices({
    working: [9 * 60, 18 * 60],
    duration: 30,
    isToday: true,
    nowMinute: 10 * 60 + 38,
    asked: null,
  });
  assert.equal(choices[0], 10 * 60 + 40);
  assert.equal(choices[1], 10 * 60 + 45);
  assert.ok(
    !choices.includes(10 * 60 + 30),
    "a time that has gone is not offered",
  );
  assert.equal(
    choices.at(-1),
    17 * 60 + 30,
    "the last start still finishes by closing",
  );
});

test("squeeze: another day offers the whole working day, and keeps the time asked for", () => {
  const choices = startChoices({
    working: [9 * 60, 18 * 60],
    duration: 30,
    isToday: false,
    nowMinute: 15 * 60,
    asked: 11 * 60 + 10,
  });
  assert.equal(choices[0], 9 * 60);
  assert.ok(choices.includes(11 * 60 + 10));
  assert.deepEqual(
    startChoices({
      working: null,
      duration: 30,
      isToday: false,
      nowMinute: 0,
      asked: 600,
    }),
    [],
  );
});

test("squeeze: a quick cut before the next client clashes with it, so it is squeezed in", () => {
  // Next client at 11:00 for 45 minutes; a 30-minute cut from 10:40 runs into it.
  const spans: [number, number][] = [[11 * 60, 11 * 60 + 45]];
  assert.equal(clashes(spans, 10 * 60 + 40, 30), true);
  // Finishing exactly as they arrive is clear.
  assert.equal(clashes(spans, 10 * 60 + 30, 30), false);
  assert.equal(clashes(spans, 11 * 60 + 45, 30), false);
});

test("squeeze: Squeeze in on a trim starts with it, or now if it has already begun", () => {
  const trim = { local_date: "2026-11-10", start_minute: 10 * 60 };
  assert.equal(squeezeStart(trim, "2026-11-10", 10 * 60 + 12), 10 * 60 + 15);
  assert.equal(squeezeStart(trim, "2026-11-10", 9 * 60), 10 * 60);
  assert.equal(
    squeezeStart({ ...trim, local_date: "2026-11-12" }, "2026-11-10", 15 * 60),
    10 * 60,
  );
});
