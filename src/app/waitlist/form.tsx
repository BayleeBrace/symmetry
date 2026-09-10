"use client";
import { useState } from "react";
import { BARBERS, SERVICES, shopToday, addDays } from "@/lib/booking-data";
export function WaitlistForm({
  token,
  leave,
}: {
  token?: string;
  leave?: boolean;
}) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="details-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          const r = await fetch("/api/waitlist", {
            method: token ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              token
                ? { token, action: leave ? "leave" : "verify" }
                : Object.fromEntries(f),
            ),
          });
          const d = await r.json();
          setMessage(d.message || d.error);
        } catch {
          setMessage("Please try again later.");
        }
      }}
    >
      {!token && (
        <>
          <label>
            email
            <input name="email" type="email" required />
          </label>
          <label>
            preferred date
            <input
              name="date"
              type="date"
              required
              min={shopToday()}
              max={addDays(shopToday(), 120)}
            />
          </label>
          <label>
            barber
            <select name="barber">
              <option value="any">any barber</option>
              {Object.entries(BARBERS).map(([id, b]) => (
                <option key={id} value={id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            trim
            <select name="service">
              {SERVICES.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <p className="privacy-note">
        We use your details to manage this waitlist request. Read our{" "}
        <a href="/privacy">privacy notice</a>.
      </p>
      <button>
        {token
          ? leave
            ? "leave waitlist"
            : "confirm waitlist request"
          : "join the waitlist"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
