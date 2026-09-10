import test from "node:test";
import assert from "node:assert/strict";
import {
  PUSH_KINDS,
  dayAheadShopText,
  dayAheadText,
  overdueText,
} from "../src/lib/push-kinds.ts";

test("staff push wording never needs a customer name and reads as a sentence", () => {
  assert.equal(
    dayAheadText(6, "9:30"),
    "6 trims on your chair, first at 9:30.",
  );
  assert.equal(
    dayAheadText(1, "11:00"),
    "1 trim on your chair, first at 11:00.",
  );
  assert.equal(dayAheadText(0, null), "Nothing booked on your chair yet.");
  assert.equal(
    dayAheadShopText(
      [
        { name: "Sean", count: 6 },
        { name: "Travis", count: 5 },
        { name: "Dylan", count: 0 },
      ],
      "9:00",
    ),
    "11 trims across the shop, first at 9:00. Sean 6, Travis 5, Dylan 0.",
  );
  assert.equal(
    dayAheadShopText([{ name: "Sean", count: 0 }], null),
    "Nothing booked across the shop yet.",
  );
  assert.match(overdueText("10:00"), /^The 10:00 has not been marked/);
  // Every kind has a label for the settings screen and a sample for the test button.
  for (const k of PUSH_KINDS) {
    assert.ok(k.label.length > 3);
    assert.ok(k.sample.title.length > 2 && k.sample.body.length > 10);
  }
  assert.equal(new Set(PUSH_KINDS.map((k) => k.id)).size, PUSH_KINDS.length);
});
