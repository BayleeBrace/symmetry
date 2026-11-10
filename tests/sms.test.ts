import test from "node:test";
import assert from "node:assert/strict";
import { readShortCode, shortCode } from "../src/lib/short-link.ts";
import {
  SMS_PART,
  shortDate,
  smsText,
  smsWaitlistText,
} from "../src/lib/message-copy.ts";

const KEY = "k".repeat(40);
const GROUP = "3f2b8c1e-9a4d-4e7b-b6c5-0d1e2f3a4b5c";
const NOW = Date.UTC(2026, 10, 10, 12);
const DAY = 86_400_000;
const LINK = "https://symmetrywales.com/b/" + shortCode(GROUP, KEY, NOW);
// Only plain GSM characters, so a text is never sent as Unicode at 70 a part.
const GSM = /^[A-Za-z0-9 @£$¥\n\r!"#%&'()*+,\-./:;<=>?_]*$/;

test("short link: 35 characters, and opens the booking it was made for", () => {
  const code = shortCode(GROUP, KEY, NOW);
  assert.equal(code.length, 35);
  assert.equal(LINK.replace("https://", "").length, 55);
  assert.equal(readShortCode(code, KEY, NOW), GROUP);
  assert.equal(readShortCode(code, KEY, NOW + 179 * DAY), GROUP);
});

test("short link: stops working after 180 days", () => {
  const code = shortCode(GROUP, KEY, NOW);
  assert.equal(readShortCode(code, KEY, NOW + 181 * DAY), null);
});

test("short link: an altered code, another key or junk opens nothing", () => {
  const code = shortCode(GROUP, KEY, NOW);
  for (let i = 0; i < code.length; i++) {
    const swap = code[i] === "A" ? "B" : "A";
    const changed = code.slice(0, i) + swap + code.slice(i + 1);
    if (changed !== code) assert.equal(readShortCode(changed, KEY, NOW), null);
  }
  assert.equal(readShortCode(code, "x".repeat(40), NOW), null);
  assert.equal(readShortCode("hello", KEY, NOW), null);
  assert.equal(readShortCode(code + "A", KEY, NOW), null);
  assert.throws(() => shortCode("not-an-id", KEY, NOW));
});

test("texts: dates read like a phone shows them", () => {
  assert.equal(shortDate("2026-11-14"), "Sat 14 Nov");
  assert.equal(shortDate("2026-03-29"), "Sun 29 Mar");
});

const longest = {
  date: "Wed 30 Sep",
  time: "11:45",
  service: "Fade / skin fade with beard",
  barber: "Travis",
};
const kinds = [
  "confirmed",
  "reminder",
  "moved",
  "cancelled",
  "no_show",
  "running_late",
  "delayed",
  "something_new",
];

test("texts: every kind fits one part, in plain characters, with the link", () => {
  for (const kind of kinds) {
    const text = smsText({
      kind,
      trims: [longest],
      link: LINK,
      lateMinutes: 15,
      minutes: 20,
    });
    assert.ok(text.length <= SMS_PART, `${kind}: ${text.length} ${text}`);
    assert.match(text, GSM, kind);
    if (kind !== "delayed") assert.ok(text.includes("symmetrywales.com/b/"));
    assert.ok(!text.includes("https://"), kind);
  }
});

test("texts: the longest service still fits with the barber and the service", () => {
  const text = smsText({ kind: "reminder", trims: [longest], link: LINK });
  assert.ok(
    text.startsWith(
      "Symmetry reminder: Wed 30 Sep at 11:45 with Travis. Fade / skin fade with beard. Change or cancel: symmetrywales.com/b/",
    ),
    text,
  );
});

test("texts: a name too long for one part drops the service, keeping when and who", () => {
  const huge = {
    ...longest,
    service: "Fade / skin fade with beard and a hot towel shave",
  };
  const text = smsText({ kind: "moved", trims: [huge], link: LINK });
  assert.ok(text.length <= SMS_PART, text);
  assert.ok(text.includes("Wed 30 Sep at 11:45 with Travis."));
  assert.ok(!text.includes("hot towel"));
});

test("texts: curly apostrophes are straightened", () => {
  const text = smsText({
    kind: "confirmed",
    trims: [{ ...longest, service: "Under 16’s fade" }],
    link: LINK,
  });
  assert.ok(text.includes("Under 16's fade"));
  assert.match(text, GSM);
});

test("texts: several trims booked together say how many and when the first is", () => {
  const text = smsText({
    kind: "confirmed",
    trims: [longest, { ...longest, date: "Wed 28 Oct" }],
    link: LINK,
  });
  assert.ok(
    text.startsWith(
      "Symmetry: 2 trims booked, the first on Wed 30 Sep at 11:45 with Travis.",
    ),
  );
  assert.ok(text.length <= SMS_PART);
});

test("texts: running late without minutes still reads", () => {
  const text = smsText({
    kind: "running_late",
    trims: [longest],
    link: LINK,
    lateMinutes: null,
  });
  assert.ok(text.includes("you'll be late."));
});

test("texts: a waitlist offer fits one part", () => {
  const url =
    "https://symmetrywales.com/book?barber=travis&service=fade-beard&date=2026-11-14";
  const text = smsWaitlistText("Sat 14 Nov", url);
  assert.ok(text.length <= SMS_PART, text);
  assert.ok(text.includes("symmetrywales.com/book?barber=travis"));
  assert.match(text, GSM);
});
