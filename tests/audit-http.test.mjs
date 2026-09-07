import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL;
const run = base ? test : test.skip;
run(
  "live page metadata, hero and public information stay consistent",
  async () => {
    const home = await fetch(base + "/");
    const html = await home.text();
    assert.equal(home.status, 200);
    assert.match(html, /sizes="100vw"/);
    assert.match(html, /name="description" content="Independent barbers/);
    assert.match(html, /formerly Studio 4 Barbers/);
    assert.match(html, /href="#main-content"/);
    assert.match(
      home.headers.get("content-security-policy-report-only"),
      /default-src 'self'/,
    );
    for (const path of ["/privacy", "/cancellation-policy", "/waitlist"]) {
      const r = await fetch(base + path);
      assert.equal(r.status, 200);
      const body = await r.text();
      assert.match(body, /site-footer/);
      assert.match(body, /href="\/privacy"/);
    }
    const hours = await (await fetch(base + "/hours")).text();
    assert.match(hours, /<dl class="opening-hours"/);
    assert.match(hours, /<time dateTime="09:00"/i);
    assert.match(
      hours,
      /<title>Opening Hours &amp; Location in Saundersfoot \| Symmetry Barbers<\/title>/,
    );
    const missing = await fetch(base + "/not-a-real-page");
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /wrong chair/);
  },
);
run(
  "share cards are compact JPEGs and install icons are included",
  async () => {
    for (const path of [
      "/opengraph-image",
      "/prices/opengraph-image",
      "/hours/opengraph-image",
      "/book/opengraph-image",
    ]) {
      const r = await fetch(base + path);
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type"), /image\/jpeg/);
      const bytes = new Uint8Array(await r.arrayBuffer());
      assert.equal(bytes[0], 255);
      assert.equal(bytes[1], 216);
      assert.ok(bytes.length < 200000);
    }
    const manifest = await (await fetch(base + "/manifest.webmanifest")).json();
    assert.ok(manifest.icons.some((i) => i.sizes === "192x192"));
    assert.ok(
      manifest.icons.some(
        (i) => i.sizes === "512x512" && i.purpose === "maskable",
      ),
    );
  },
);
run(
  "preview password rejects foreign origins and throttles repeated guesses",
  async () => {
    const send = (origin = base) =>
      fetch(base + "/api/site-access", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong-audit-password" }),
      });
    assert.equal((await send("https://unrelated.example")).status, 400);
    for (let i = 0; i < 10; i++) assert.equal((await send()).status, 401);
    assert.equal((await send()).status, 429);
  },
);
run(
  "brand prices use one nine-service list, retain supplied amounts and omit durations",
  async () => {
    const html = await (await fetch(base + "/prices")).text();
    assert.match(html, /brand-price-table/);
    assert.match(html, /under thirteens/);
    assert.match(html, /15\.50/);
    assert.match(html, /prices in pounds/);
    assert.doesNotMatch(html, />\d+ min</);
    assert.doesNotMatch(html, /standard cut/);
    const book = await (await fetch(base + "/book")).text();
    assert.match(book, /symmetry-wordmark-black.svg/);
    assert.doesNotMatch(book, /id="main-navigation"/);
  },
);
