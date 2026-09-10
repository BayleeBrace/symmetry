"use client";
import { DRAFT_KEY } from "@/lib/booking-draft";
import { useEffect, useState } from "react";
export function Recovery() {
  const [message, setMessage] = useState("");
  return (
    <form
      className="details-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          const r = await fetch("/api/bookings/recover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: f.get("email") }),
          });
          const d = await r.json();
          setMessage(d.message || d.error);
        } catch {
          setMessage("Please try again.");
        }
      }}
    >
      <label>
        booking email
        <input name="email" type="email" required />
      </label>
      <button>send my booking link</button>
      <p role="status">{message}</p>
    </form>
  );
}
export function SetupComplete({ session }: { session: string }) {
  const [message, setMessage] = useState("Confirming your trim…");
  useEffect(() => {
    fetch("/api/stripe/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {}
        location.replace("/bookings?token=" + encodeURIComponent(d.token));
      })
      .catch((e) => setMessage(e.message));
  }, [session]);
  return (
    <>
      <p role="status">{message}</p>
      <p>
        <a href="/bookings">check my bookings</a> ·{" "}
        <a href="/book">return to my saved trims</a>
      </p>
    </>
  );
}
