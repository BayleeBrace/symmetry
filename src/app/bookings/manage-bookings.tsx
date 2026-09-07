"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BARBERS,
  clock,
  fullDate,
  makeSlots,
  money,
  shopToday,
  addDays,
  type Slot,
  type BarberId,
  type Service,
  type OPENING_HOURS,
} from "@/lib/booking-data";
import type { ManagedBookingGroup } from "@/lib/manage-bookings";
import {
  deadlineLabel,
  cancellationDeadline,
  shopInstant,
} from "@/lib/booking-policy";
import { PushButton } from "@/components/push-button";
type Group = ManagedBookingGroup & {
  catalog: { services: Service[]; hours: typeof OPENING_HOURS };
};
export function ManageBookings({ token }: { token: string }) {
  const [group, setGroup] = useState<Group | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [move, setMove] = useState(""),
    [date, setDate] = useState(""),
    [barber, setBarber] = useState<BarberId>("sean"),
    [service, setService] = useState(""),
    [slots, setSlots] = useState<Slot[]>([]),
    [preferences, setPreferences] = useState(""),
    [notice, setNotice] = useState("");
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const sequence = useRef(0),
    times = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(
      "/api/bookings/manage?token=" + encodeURIComponent(token),
      { cache: "no-store" },
    );
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    setGroup(d);
    setPreferences(d.customer.preferences || "");
  }, [token]);
  useEffect(() => {
    const t = setTimeout(
      () => void load().catch((e) => setError(e.message)),
      0,
    );
    return () => clearTimeout(t);
  }, [load]);
  async function change(data: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/bookings/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, token }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMove("");
      setNotice("All updated.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function availability(value: string, b = barber, s = service) {
    const current = ++sequence.current;
    setDate(value);
    setSlots([]);
    if (!value || !group) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/availability?date=${value}&barber=${b}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (current !== sequence.current) return;
      setSlots(makeSlots(value, b, s, data.busy, group.catalog));
      requestAnimationFrame(() =>
        times.current?.scrollIntoView({
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      );
    } catch (e) {
      if (current === sequence.current) setError((e as Error).message);
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }
  if (!group) return <p role="status">{error || "loading your trims…"}</p>;
  const policy = group.policy;
  return (
    <>
      <p>
        Hi {group.customer.name.split(" ")[0]}. Everything for your next trim is
        here.
      </p>
      {policy && (
        <p>
          Free cancellation until {policy.cancellation_hours} hours before. Late
          cancellation: {policy.late_percent}%. No-show:{" "}
          {policy.no_show_percent}%.
        </p>
      )}
      <div className="manage-links">
        <a href={"/api/calendar?token=" + encodeURIComponent(token)}>
          add all to calendar
        </a>
        <PushButton token={token} />
      </div>
      <p className="price-note">prices in pounds.</p>
      <div className="managed-booking-list">
        {group.appointments.map((a) => {
          const active =
            a.status === "booked" &&
            shopInstant(a.date, a.time).getTime() > now;
          return (
            <article className="managed-booking" key={a.id}>
              <p className="managed-date">
                {fullDate(a.date)} · {clock(a.time)}
              </p>
              <h2>{a.service.name}</h2>
              <p>
                with {a.barber.name} · {a.duration} min ·
                {money(a.pricePence / 100)} · {a.status.replace("_", " ")}
              </p>
              <p className="cancellation-deadline">
                {active && policy
                  ? `Free cancellation until ${deadlineLabel(a.date, a.time, policy.cancellation_hours)}.`
                  : ""}
              </p>
              <div className="manage-links">
                <a
                  href={`/book?barber=${a.barber.slug}&service=${a.service.slug}`}
                >
                  book my usual
                </a>
                {active && (
                  <>
                    <a
                      href={`/api/calendar?token=${encodeURIComponent(token)}&booking=${a.id}`}
                    >
                      add to calendar
                    </a>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setMove(a.id);
                        setBarber(a.barber.slug);
                        setService(a.service.slug);
                        void availability(
                          a.date,
                          a.barber.slug,
                          a.service.slug,
                        );
                      }}
                    >
                      change trim
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        const fee = policy
                          ? money(
                              Math.round(
                                (a.pricePence * policy.late_percent) / 100,
                              ) / 100,
                            )
                          : "0";
                        const late =
                          policy &&
                          Date.now() >
                            cancellationDeadline(
                              a.date,
                              a.time,
                              policy.cancellation_hours,
                            ).getTime();
                        if (
                          confirm(
                            late
                              ? `Cancel this trim and accept the ${fee} pounds late cancellation fee?`
                              : "Cancel this trim? You are within the free cancellation period.",
                          )
                        )
                          void change({
                            action: "cancel",
                            bookingId: a.id,
                            acceptFee: true,
                          });
                      }}
                    >
                      cancel
                    </button>
                    {a.date === shopToday() && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void change({
                            action: "late",
                            bookingId: a.id,
                            minutes: 10,
                          })
                        }
                      >
                        running 10 min late
                      </button>
                    )}
                  </>
                )}
              </div>
              {active && <WalletLinks token={token} booking={a.id} />}
              {move === a.id && (
                <div className="move-panel">
                  <label>
                    barber
                    <select
                      value={barber}
                      onChange={(e) => {
                        setBarber(e.target.value as BarberId);
                        void availability(
                          date,
                          e.target.value as BarberId,
                          service,
                        );
                      }}
                    >
                      {Object.entries(BARBERS).map(([id, b]) => (
                        <option key={id} value={id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    trim
                    <select
                      value={service}
                      onChange={(e) => {
                        setService(e.target.value);
                        void availability(date, barber, e.target.value);
                      }}
                    >
                      {group.catalog.services
                        .filter((s) => s.barbers[barber])
                        .map((s) => (
                          <option value={s.id} key={s.id}>
                            {s.name} · {money(s.barbers[barber].price)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    date
                    <input
                      type="date"
                      min={shopToday()}
                      max={addDays(shopToday(), 120)}
                      value={date}
                      onChange={(e) => void availability(e.target.value)}
                    />
                  </label>
                  <div ref={times} className="move-times">
                    {busy ? (
                      <p>checking the diary…</p>
                    ) : slots.length ? (
                      slots.map((s) => (
                        <button
                          key={s.time}
                          onClick={() =>
                            void change({
                              action: "reschedule",
                              bookingId: a.id,
                              date,
                              time: s.time,
                              barber,
                              service,
                            })
                          }
                        >
                          {clock(s.time)}
                        </button>
                      ))
                    ) : (
                      <p>No available times. Try another date.</p>
                    )}
                  </div>
                  <button disabled={busy} onClick={() => setMove("")}>
                    keep existing trim
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <form
        className="details-form"
        onSubmit={(e) => {
          e.preventDefault();
          void change({ action: "preferences", preferences });
        }}
      >
        <label>
          your preferences
          <textarea
            maxLength={1000}
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
          />
        </label>
        <button disabled={busy}>save notes</button>
      </form>
      <p>
        After moving or cancelling a trim, update any calendar entry you
        previously downloaded.
      </p>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </>
  );
}
function WalletLinks({ token, booking }: { token: string; booking: string }) {
  const [enabled, setEnabled] = useState<{
    apple: boolean;
    google: boolean;
  } | null>(null);
  useEffect(() => {
    fetch("/api/wallet")
      .then((r) => r.json())
      .then(setEnabled)
      .catch(() => {});
  }, []);
  return enabled ? (
    <div className="manage-links">
      {enabled.apple && (
        <a
          href={`/api/wallet?provider=apple&token=${encodeURIComponent(token)}&booking=${booking}`}
        >
          Apple Wallet
        </a>
      )}
      {enabled.google && (
        <a
          href={`/api/wallet?provider=google&token=${encodeURIComponent(token)}&booking=${booking}`}
        >
          Google Wallet
        </a>
      )}
    </div>
  ) : null;
}
