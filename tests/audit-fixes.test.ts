import test from "node:test";
import assert from "node:assert/strict";
import { csvCell } from "../src/lib/csv.ts";
import { fetchAll } from "../src/lib/paging.ts";
import {
  bookingText,
  sentence,
  waitlistOfferText,
} from "../src/lib/message-copy.ts";
import { offerOrder } from "../src/lib/waitlist-order.ts";

test("spreadsheet cells that look like formulas are made plain text", () => {
  assert.equal(csvCell("Sam Jones"), '"Sam Jones"');
  assert.equal(csvCell('Says "hi"'), '"Says ""hi"""');
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(csvCell("+447700900123"), `"'+447700900123"`);
  assert.equal(csvCell("-1"), `"'-1"`);
  assert.equal(csvCell("@SUM(A1)"), `"'@SUM(A1)"`);
  assert.equal(csvCell("\tx"), `"'\tx"`);
  assert.equal(csvCell("\rx"), `"'\rx"`);
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(17.5), '"17.5"');
});

test("paging keeps asking until a short page, and stops at the cap", async () => {
  const rows = Array.from({ length: 2345 }, (_, i) => i);
  const asked: [number, number][] = [];
  const page = async (from: number, to: number) => {
    asked.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  const all = await fetchAll(page);
  assert.equal(all.data.length, 2345);
  assert.deepEqual(asked, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
  const capped = await fetchAll(page, { max: 1500 });
  assert.equal(capped.data.length, 1500);
  const failing = await fetchAll(async (from) =>
    from
      ? { data: null, error: "down" }
      : { data: rows.slice(0, 1000), error: null },
  );
  assert.equal(failing.error, "down");
});

test("waitlist offers go round everyone for a day before anyone is asked again", () => {
  const a = { id: "a", created_at: "2026-11-01T09:00:00Z" };
  const b = { id: "b", created_at: "2026-11-01T10:00:00Z" };
  const c = { id: "c", created_at: "2026-11-01T11:00:00Z" };
  const order = (counts: Record<string, number>) =>
    offerOrder([c, a, b], (id) => counts[id] ?? 0).map((w) => w.id);
  // Nobody asked yet: first come, first offered.
  assert.deepEqual(order({}), ["a", "b", "c"]);
  // A has had the day once: B and C get their turn first.
  assert.deepEqual(order({ a: 1 }), ["b", "c", "a"]);
  assert.deepEqual(order({ a: 1, b: 1 }), ["c", "a", "b"]);
  // Twice is the most anyone is offered the same day.
  assert.deepEqual(order({ a: 2, b: 1, c: 1 }), ["b", "c"]);
  assert.deepEqual(order({ a: 2, b: 2, c: 2 }), []);
});

test("headings end in one full stop, and questions keep their mark", () => {
  assert.equal(sentence("Your Symmetry booking"), "Your Symmetry booking.");
  assert.equal(sentence("Time for a trim?"), "Time for a trim?");
  assert.equal(sentence("Reminders stopped."), "Reminders stopped.");
});

test("booking messages list every trim once and say what to do once", () => {
  const policy = {
    hours: 6,
    latePercent: 50,
    noShowPercent: 100,
    deadline: "Tue, 10 November 2026 at 3:00",
  };
  const cut = {
    when: "Tue, 10 November 2026 at 9:00",
    service: "standard cut",
    barber: "Sean",
  };
  const one = bookingText({ kind: "confirmed", trims: [cut], policy });
  assert.equal(
    one,
    "Tue, 10 November 2026 at 9:00: standard cut with Sean.\nFree cancellation until Tue, 10 November 2026 at 3:00. Late cancellation: 50%. No-show: 100%. Move or cancel using your booking link.",
  );
  assert.doesNotMatch(one, /Your Symmetry booking/);
  assert.equal(one.match(/link/g)?.length, 1);
  const basket = bookingText({
    kind: "confirmed",
    trims: [
      cut,
      { ...cut, when: "Tue, 17 November 2026 at 9:00" },
      { ...cut, when: "Tue, 24 November 2026 at 9:00", barber: "Travis" },
    ],
    policy,
  });
  assert.equal(basket.split("\n").length, 4);
  assert.match(basket, /24 November 2026 at 9:00: standard cut with Travis\./);
  assert.match(basket, /up to 6 hours before each trim/);
  assert.equal(
    bookingText({ kind: "running_late", trims: [cut], lateMinutes: 10 }),
    "Tue, 10 November 2026 at 9:00: standard cut with Sean.\nThe shop has been told you expect to be 10 minutes late.",
  );
  assert.match(
    bookingText({ kind: "cancelled", trims: [cut], policy }),
    /\nYour booking link has the details\.$/,
  );
});

test("a waitlist offer names the day and the call to action", () => {
  assert.equal(
    waitlistOfferText("Tue, 10 November 2026"),
    "A time is available on Tue, 10 November 2026. Book a trim to reserve it; availability can change.",
  );
  assert.match(waitlistOfferText(null), /your requested day/);
  for (const copy of [waitlistOfferText(null), sentence("Time for a trim?")])
    assert.doesNotMatch(copy, /!|premium|experience|gents/i);
});
