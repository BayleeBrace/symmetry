import test from "node:test";
import assert from "node:assert/strict";
import { HELP, HELP_TOPICS, searchHelp } from "../src/lib/help.ts";

test("help: every article has a unique id, a known topic and steps", () => {
  const ids = new Set(HELP.map((a) => a.id));
  assert.equal(ids.size, HELP.length);
  for (const a of HELP) {
    assert.ok(HELP_TOPICS.includes(a.topic), a.id);
    assert.ok(a.steps.length > 0, a.id);
    assert.ok(a.title.length > 0, a.id);
  }
});

test("help: searching finds the right how-to first", () => {
  assert.equal(searchHelp("squeeze")[0]?.id, "squeeze");
  assert.equal(searchHelp("walk in")[0]?.id, "walk-in");
  assert.equal(searchHelp("card machine")[0]?.id, "card-machine");
  assert.equal(searchHelp("Face ID")[0]?.id, "face-id");
  assert.equal(searchHelp("running behind")[0]?.id, "behind");
  assert.ok(searchHelp("rent").some((a) => a.id === "payouts"));
});

test("help: every word typed has to match, and part-words count", () => {
  assert.deepEqual(searchHelp("zzz nothing here"), []);
  assert.ok(searchHelp("holi").some((a) => a.id === "block"));
  assert.ok(searchHelp("didnt turn up").some((a) => a.id === "no-show"));
});

test("help: barbers don't see the owner's how-tos, the owner does", () => {
  assert.ok(!searchHelp("refund").some((a) => a.owner));
  assert.ok(
    searchHelp("refund", { owner: true }).some((a) => a.id === "refund"),
  );
  assert.ok(!searchHelp("").some((a) => a.owner));
  assert.equal(searchHelp("", { owner: true }).length, HELP.length);
});
