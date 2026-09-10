import test from "node:test";
import assert from "node:assert/strict";
import {
  PUSH_KINDS,
  dayAheadShopText,
  dayAheadText,
  dayEndShopText,
  dayEndText,
  overdueText,
  paydayBarberText,
  paydayOwnerText,
} from "../src/lib/push-kinds.ts";

test("end of day and payday pushes read as plain sentences with pounds", () => {
  assert.equal(
    dayEndText({ count: 9, cardPence: 22000, cashPence: 8000, otherPence: 0 }),
    "9 trims, £220 card, £80 cash.",
  );
  assert.equal(
    dayEndText({ count: 1, cardPence: 2250, cashPence: 0, otherPence: 500 }),
    "1 trim, £22.50 card, £5 other.",
  );
  assert.equal(
    dayEndText({ count: 0, cardPence: 0, cashPence: 0, otherPence: 0 }),
    "Nothing checked out today.",
  );
  assert.equal(
    dayEndShopText([
      {
        name: "Sean",
        count: 9,
        cardPence: 22000,
        cashPence: 8000,
        otherPence: 0,
      },
      {
        name: "Travis",
        count: 7,
        cardPence: 15000,
        cashPence: 3000,
        otherPence: 0,
      },
      { name: "Dylan", count: 0, cardPence: 0, cashPence: 0, otherPence: 0 },
    ]),
    "Across the shop: 16 trims, £370 card, £110 cash. Sean 9, Travis 7, Dylan 0.",
  );
  assert.equal(
    paydayOwnerText([
      { name: "Travis", netPence: 51000, paid: false },
      { name: "Dylan", netPence: 43000, paid: true },
      { name: "Ash", netPence: -4000, paid: false },
    ]),
    "Last week is ready: Travis owed £510, Dylan paid, Ash owes the shop £40.",
  );
  assert.equal(paydayOwnerText([]), "Last week: nothing to pay out.");
  assert.equal(
    paydayBarberText({
      salesPence: 88000,
      netPence: 51000,
      rentPence: 15000,
      paid: false,
    }),
    "Last week on your chair: £880 in trims. Card takings less rent comes to £510, due from the shop. Tap for the breakdown.",
  );
  assert.match(
    paydayBarberText({
      salesPence: 20000,
      netPence: -4000,
      rentPence: 15000,
      paid: false,
    }),
    /£40 to settle with the shop/,
  );
});

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
