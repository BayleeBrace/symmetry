import test from "node:test";
import assert from "node:assert/strict";
import { showsInDiary } from "../src/lib/diary-visibility.ts";

test("diary: a cancelled trim leaves the diary", () => {
  assert.equal(
    showsInDiary({ status: "cancelled", fee_status: "none" }),
    false,
  );
  assert.equal(
    showsInDiary({ status: "cancelled", fee_status: "waived" }),
    false,
  );
  assert.equal(
    showsInDiary({ status: "cancelled", fee_status: "charged" }),
    false,
  );
});

test("diary: a cancelled trim with a fee to decide stays until it is decided", () => {
  assert.equal(
    showsInDiary({ status: "cancelled", fee_status: "review" }),
    true,
  );
  assert.equal(
    showsInDiary({ status: "cancelled", fee_status: "charging" }),
    true,
  );
});

test("diary: every other trim still shows, no shows included", () => {
  for (const status of ["booked", "arrived", "done", "no_show"])
    assert.equal(showsInDiary({ status, fee_status: "none" }), true);
});
