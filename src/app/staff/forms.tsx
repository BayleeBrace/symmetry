"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { clock, shopToday } from "@/lib/booking-data";
import {
  type Act,
  type Barber,
  type Context,
  type Diary,
  canonicalServiceName,
  dayLabel,
  freeTimes,
  hoursFor,
  initials,
  pounds,
  timeOptions,
} from "./types";
import type { BookPrefill } from "./calendar";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

/** The diary for one day: the calendar's copy when it covers the day, else fetched. */
function useDay(date: string, cached: Diary | null) {
  const covered =
    cached &&
    date >= cached.date &&
    date <= (cached.to ?? cached.date) &&
    (cached.hoursByDay ? date in cached.hoursByDay : cached.date === date);
  const [fetched, setFetched] = useState<Diary | null>(null);
  useEffect(() => {
    if (covered) return;
    let live = true;
    api("/api/staff/diary?date=" + date)
      .then((d) => {
        if (live) setFetched(d as Diary);
      })
      .catch(() => {
        if (live) setFetched(null);
      });
    return () => {
      live = false;
    };
  }, [date, covered]);
  if (covered) return cached;
  return fetched && fetched.date === date ? fetched : null;
}

export function NewAppointment({
  ctx,
  chairs,
  allChairs,
  cached,
  prefill,
  busy,
  act,
  onClose,
  onSaved,
}: {
  ctx: Context;
  chairs: Barber[];
  allChairs: Barber[];
  cached: Diary | null;
  prefill: BookPrefill;
  busy: boolean;
  act: Act;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const options = chairs.length ? chairs : allChairs;
  const [barberId, setBarberId] = useState(
    prefill.barberId ?? options[0]?.id ?? "",
  );
  const [serviceId, setServiceId] = useState(ctx.services[0]?.id ?? "");
  const [date, setDate] = useState(prefill.date ?? shopToday());
  const [time, setTime] = useState<number | null>(prefill.minute ?? null);
  const [name, setName] = useState(prefill.client?.name ?? "");
  const [email, setEmail] = useState(prefill.client?.email ?? "");
  const [phone, setPhone] = useState(prefill.client?.phone ?? "");
  const [picked, setPicked] = useState<Client | null>(
    prefill.client ? { id: "", ...prefill.client } : null,
  );
  const [results, setResults] = useState<Client[]>([]);
  const [error, setError] = useState("");
  const day = useDay(date, cached);

  // Look up existing clients as the name is typed, so regulars are reused rather than duplicated.
  useEffect(() => {
    const term = name.trim();
    if (picked || term.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      api("/api/staff/customers?q=" + encodeURIComponent(term))
        .then((d) => {
          if (live) setResults((d.customers as Client[]).slice(0, 6));
        })
        .catch(() => {
          if (live) setResults([]);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, picked]);

  const barber = allChairs.find((b) => b.id === barberId);
  const service = ctx.services.find((s) => s.id === serviceId);
  const price = ctx.prices.find(
    (p) => p.barber_id === barberId && p.service_id === serviceId,
  );
  const duration = price?.duration ?? 30;
  const slots = day ? freeTimes(day, date, barberId, duration) : null;
  const hours = day ? hoursFor(day, date) : null;
  const choices = slots
    ? slots.free.includes(time ?? -1) || time === null
      ? slots.free
      : [...slots.free, time].sort((a, b) => a - b)
    : time !== null
      ? [time]
      : [];
  const value =
    time !== null && choices.includes(time) ? time : (choices[0] ?? null);

  return (
    <aside
      className="sheet drawer"
      role="dialog"
      aria-modal="true"
      aria-label="New appointment"
    >
      <button
        type="button"
        className="sheet-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <h2>New appointment.</h2>
      <p className="sheet-line">
        Goes straight into the diary, so online bookings cannot take the same
        time.
      </p>
      <form
        className="staff-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!barber || !service || value === null) return;
          setError("");
          try {
            await act("/api/staff/diary", {
              action: "walkin",
              date,
              time: value,
              name: name.trim(),
              email: email.trim(),
              phone: phone.trim(),
              barber: barber.slug,
              service: service.slug,
            });
            onSaved(
              `Added ${name.trim()} with ${barber.name} at ${clock(value)} on ${dayLabel(date)}.`,
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label className="wide client-field">
          Client
          <input
            value={name}
            required
            minLength={2}
            autoComplete="off"
            placeholder="Start typing a name"
            onChange={(e) => {
              setName(e.target.value);
              setPicked(null);
            }}
          />
          {picked && (
            <span className="client-picked">
              <span className="avatar">{initials(picked.name)}</span>
              Existing client
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setPicked(null);
                  setName("");
                  setEmail("");
                  setPhone("");
                }}
              >
                Clear
              </button>
            </span>
          )}
          {!picked && name.trim().length >= 2 && results.length > 0 && (
            <ul className="client-results" role="listbox">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(c);
                      setName(c.name);
                      setEmail(c.email);
                      setPhone(c.phone);
                      setResults([]);
                    }}
                  >
                    <span className="avatar">{initials(c.name)}</span>
                    <span>
                      <strong>{c.name}</strong>
                      <small>
                        {c.phone || c.email || "No contact details"}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label>
          Mobile (optional)
          <input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label>
          Email (optional)
          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Service
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            {ctx.services.map((s) => (
              <option value={s.id} key={s.id}>
                {canonicalServiceName(s.slug, s.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Chair
          <select
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
          >
            {options.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label>
          Time
          <select
            value={value ?? ""}
            disabled={!slots || choices.length === 0}
            onChange={(e) => setTime(Number(e.target.value))}
          >
            {!slots && <option value="">Checking the diary…</option>}
            {slots && choices.length === 0 && (
              <option value="">
                {slots.closed ? "Closed that day" : "No free times"}
              </option>
            )}
            {choices.map((minute) => (
              <option key={minute} value={minute}>
                {clock(minute)}
                {slots && !slots.free.includes(minute) ? " (taken)" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="price-hint">
          {price
            ? `${pounds(price.price_pence)} pounds · ${duration} min with ${barber?.name ?? ""}`
            : "No price is set for this chair and service."}
          {hours ? "" : slots ? " The shop is closed that day." : ""}
        </p>
        {error && (
          <p className="staff-error wide" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="submit"
            className="button-primary"
            disabled={busy || !price || value === null}
          >
            Save appointment
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </aside>
  );
}

export function BlockedTime({
  chairs,
  cached,
  date: initialDate,
  busy,
  act,
  onClose,
  onSaved,
}: {
  chairs: Barber[];
  cached: Diary | null;
  date: string;
  busy: boolean;
  act: Act;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [barberId, setBarberId] = useState(chairs[0]?.id ?? "");
  const [kind, setKind] = useState<"break" | "day">("break");
  const [label, setLabel] = useState("Break");
  const [from, setFrom] = useState<number | null>(null);
  const [until, setUntil] = useState<number | null>(null);
  const [error, setError] = useState("");
  const day = useDay(date, cached);
  const hours = day ? hoursFor(day, date) : null;
  const [open, close] = hours ?? [540, 1080];
  const fromValue = from ?? open;
  const untilValue = until ?? Math.min(close, fromValue + 60);
  return (
    <aside
      className="sheet drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Blocked time"
    >
      <button
        type="button"
        className="sheet-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <h2>Blocked time.</h2>
      <p className="sheet-line">
        A break, or a whole day off. Move any existing bookings first.
      </p>
      <form
        className="staff-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const wholeDay = kind === "day";
          setError("");
          try {
            await act("/api/staff/diary", {
              action: "block",
              date,
              barber: barberId,
              time: wholeDay ? 0 : fromValue,
              duration: wholeDay ? 1440 : Math.max(15, untilValue - fromValue),
              label: label.trim() || (wholeDay ? "Day off" : "Break"),
            });
            onSaved(
              wholeDay
                ? `${dayLabel(date)} blocked for ${chairs.find((b) => b.id === barberId)?.name ?? "the chair"}.`
                : `Break added on ${dayLabel(date)}.`,
            );
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label>
          Chair
          <select
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
          >
            {chairs.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          What
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value === "day" ? "day" : "break";
              setKind(next);
              setLabel(next === "day" ? "Day off" : "Break");
            }}
          >
            <option value="break">A break</option>
            <option value="day">The whole day</option>
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            required
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label>
          Label
          <input
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        {kind === "break" && (
          <>
            <label>
              From
              <select
                value={fromValue}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setFrom(next);
                  if (untilValue <= next) setUntil(next + 15);
                }}
              >
                {timeOptions(open, close - 15).map((minute) => (
                  <option key={minute} value={minute}>
                    {clock(minute)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Until
              <select
                value={untilValue}
                onChange={(e) => setUntil(Number(e.target.value))}
              >
                {timeOptions(
                  fromValue + 15,
                  Math.max(close, fromValue + 15),
                ).map((minute) => (
                  <option key={minute} value={minute}>
                    {clock(minute)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {!hours && day && (
          <p className="price-hint">The shop is closed on this day already.</p>
        )}
        {error && (
          <p className="staff-error wide" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={busy}>
            {kind === "day" ? "Block the day" : "Add the break"}
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </aside>
  );
}
