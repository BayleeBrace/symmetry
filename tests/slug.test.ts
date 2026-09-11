import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/lib/slug.ts";

test("service names become clean slugs the database accepts", () => {
  assert.equal(slugify("Fade & beard"), "fade-and-beard");
  assert.equal(slugify("  Skin fade (long) "), "skin-fade-long");
  assert.equal(slugify("Under 13s"), "under-13s");
  assert.equal(slugify("!!!"), "service");
  assert.match(slugify("x".repeat(80)), /^x{40}$/);
});
