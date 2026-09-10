import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { shopToday, addDays, isOpen } from "../src/lib/booking-data.ts";
const base = process.env.TEST_BASE_URL;
const run = base ? test : test.skip;
run("preview renders rebooking directly at the date step", async () => {
  const r = await fetch(base + "/book?barber=sean&service=fade");
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /your dates\./);
  assert.match(html, /fade/);
});
run(
  "preview checkout accepts a valid booking, rejects overlap and missing consent",
  async () => {
    let date = addDays(shopToday(), 1);
    while (!isOpen(date)) date = addDays(date, 1);
    const payload = {
      requestId: randomUUID(),
      policyVersion: "2026-09-07",
      policyAccepted: true,
      customer: {
        name: "Preview Tester",
        email: "preview@example.com",
        country: "GB",
        phone: "07911123456",
        marketing: false,
      },
      appointments: [
        {
          date,
          barber: "sean",
          service: "fade",
          time: 720,
          price: 24,
          duration: 40,
        },
      ],
    };
    const send = (body) =>
      fetch(base + "/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base },
        body: JSON.stringify(body),
      });
    let r = await send(payload);
    const result = await r.json();
    assert.equal(r.status, 200, JSON.stringify(result));
    assert.equal(result.mode, "preview");
    r = await send({
      ...payload,
      appointments: [...payload.appointments, ...payload.appointments],
    });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /overlap/);
    r = await send({ ...payload, policyAccepted: false });
    assert.equal(r.status, 400);
    r = await fetch(base + "/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://unrelated.example",
      },
      body: JSON.stringify(payload),
    });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /origin/);
  },
);
run(
  "private routes and card callbacks fail safely without access",
  async () => {
    assert.equal((await fetch(base + "/api/staff/readiness")).status, 403);
    assert.equal((await fetch(base + "/api/staff/alerts")).status, 403);
    assert.equal((await fetch(base + "/api/staff/team")).status, 403);
    assert.equal((await fetch(base + "/api/staff/customers")).status, 403);
    assert.equal((await fetch(base + "/api/staff/sales")).status, 403);
    assert.equal((await fetch(base + "/api/staff/marketing")).status, 403);
    assert.equal((await fetch(base + "/api/staff/passkey")).status, 403);
    assert.equal((await fetch(base + "/api/staff/payouts")).status, 403);
    // A Face ID challenge needs no session; without LINK_SIGNING_SECRET it refuses cleanly.
    const challenge = await fetch(base + "/api/staff/passkey", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: '{"action":"login-options"}',
    });
    assert.ok([200, 401].includes(challenge.status));
    if (challenge.status === 200) assert.ok((await challenge.json()).challenge);
    assert.equal(
      (await fetch(base + "/api/reminders/stop?token=not-a-link")).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + "/api/staff/password", {
          method: "POST",
          headers: { Origin: base, "Content-Type": "application/json" },
          body: '{"password":"longenough1"}',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + "/api/staff/session", {
          method: "PATCH",
          headers: { Origin: base },
        })
      ).status,
      401,
    );
    assert.equal((await fetch(base + "/api/jobs")).status, 401);
    assert.equal(
      (
        await fetch(base + "/api/stripe/webhook", {
          method: "POST",
          body: "{}",
        })
      ).status,
      400,
    );
    assert.equal(
      (await fetch(base + "/api/bookings/manage?token=not-a-real-booking"))
        .status,
      404,
    );
  },
);
