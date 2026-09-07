"use client";
import { DRAFT_KEY } from "@/lib/booking-draft";
import { useEffect, useState } from "react";
export function Recovery() {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
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
          setFailed(!r.ok);
        } catch {
          setMessage("Please try again.");
        }
      }}
    >
      <label>
        Booking email
        <input name="email" type="email" required />
      </label>
      <button>Send my booking link</button>
      <p
        role={failed ? "alert" : "status"}
        className={failed ? "form-error" : ""}
      >
        {message}
      </p>
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
        <a href="/bookings">Check my bookings</a> ·{" "}
        <a href="/book">Return to my saved trims</a>
      </p>
    </>
  );
}
