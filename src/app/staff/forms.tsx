"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { addDays, clock, shopToday } from "@/lib/booking-data";
import {
  type Act,
  type Barber,
  type Context,
  type Diary,
  OPEN_STATUSES,
  WALK_IN,
  canonicalServiceName,
  chairHours,
  customerOf,
  dayLabel,
  freeTimes,
  hoursFor,
  initials,
  pounds,
  shortDay,
  timeOptions,
} from "./types";
import type { BookPrefill } from "./calendar";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type BlockPrefill = {
  date: string;
  barberId?: string;
  minute?: number;
};

const REPEAT_LABEL: Record<number, string> = {
  1: "every week",
  2: "every 2 weeks",
  3: "every 3 weeks",
  4: "every 4 weeks",
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
  const [every, setEvery] = useState(0);
  const [times, setTimes] = useState(4);
  const [confirmSqueeze, setConfirmSqueeze] = useState(false);
  const [error, setError] = useState("");
  const day = useDay(date, cached);
  const walkIn = picked?.name === WALK_IN;

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
  const working = day ? chairHours(day, date, barberId) : null;
  // Every quarter hour the chair is working, taken ones included: staff can squeeze a trim in.
  const inHours =
    working && !slots?.closed
      ? timeOptions(working[0], working[1] - duration)
      : [];
  const choices = slots
    ? time === null || inHours.includes(time)
      ? inHours
      : [...inHours, time].sort((a, b) => a - b)
    : time !== null
      ? [time]
      : [];
  const value =
    time !== null && choices.includes(time) ? time : (choices[0] ?? null);
  const taken = value !== null && slots ? !slots.free.includes(value) : false;
  const overlapping =
    day && value !== null
      ? day.bookings.filter(
          (b) =>
            (!b.local_date || b.local_date === date) &&
            b.barber_id === barberId &&
            OPEN_STATUSES.includes(b.status) &&
            b.start_minute < value + duration &&
            b.start_minute + b.duration > value,
        )
      : [];
  const lastDate =
    every > 0 ? addDays(date, (times - 1) * every * 7) : undefined;

  const save = async (squeeze: boolean) => {
    if (!barber || !service || value === null) return;
    setError("");
    setConfirmSqueeze(false);
    try {
      const result = (await act("/api/staff/diary", {
        action: "walkin",
        date,
        time: value,
        name: name.trim(),
        email: walkIn ? "" : email.trim(),
        phone: walkIn ? "" : phone.trim(),
        barber: barber.slug,
        service: service.slug,
        ...(squeeze ? { squeeze: true } : {}),
        ...(every > 0 ? { repeat: { every, times } } : {}),
      })) as { made?: number; skipped?: number } | undefined;
      const made = result?.made ?? 1;
      const skipped = result?.skipped ?? 0;
      let message = `Added ${name.trim()} with ${barber.name} at ${clock(value)} on ${dayLabel(date)}`;
      if (every > 0 && made > 1)
        message += `, and ${made - 1} more ${REPEAT_LABEL[every]}`;
      message += ".";
      if (skipped > 0)
        message += ` ${skipped} of the repeat dates ${skipped === 1 ? "was" : "were"} taken and skipped.`;
      onSaved(message);
    } catch (e) {
      setError((e as Error).message);
    }
  };

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
        onSubmit={(event) => {
          event.preventDefault();
          if (taken) {
            setConfirmSqueeze(true);
            return;
          }
          void save(false);
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
              {walkIn ? "Walk-in, no details needed" : "Existing client"}
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
          {!picked && (
            <span className="client-quick">
              <button
                type="button"
                className="chip-button"
                onClick={() => {
                  setPicked({ id: "", name: WALK_IN, email: "", phone: "" });
                  setName(WALK_IN);
                  setEmail("");
                  setPhone("");
                  setResults([]);
                }}
              >
                Walk-in
              </button>
              <small>Someone off the street, no details needed.</small>
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
        {!walkIn && (
          <>
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
          </>
        )}
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
            onChange={(e) => {
              setTime(Number(e.target.value));
              setConfirmSqueeze(false);
            }}
          >
            {!slots && <option value="">Checking the diary…</option>}
            {slots && choices.length === 0 && (
              <option value="">
                {slots.closed ? "Closed that day" : "No times today"}
              </option>
            )}
            {choices.map((minute) => (
              <option key={minute} value={minute}>
                {clock(minute)}
                {slots && !slots.free.includes(minute)
                  ? " (taken, squeeze in)"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Repeat
          <select
            value={every}
            onChange={(e) => setEvery(Number(e.target.value))}
          >
            <option value={0}>Just this once</option>
            <option value={1}>Every week</option>
            <option value={2}>Every 2 weeks</option>
            <option value={3}>Every 3 weeks</option>
            <option value={4}>Every 4 weeks</option>
          </select>
        </label>
        {every > 0 && (
          <label>
            How many times
            <select
              value={times}
              onChange={(e) => setTimes(Number(e.target.value))}
            >
              {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} times
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="price-hint">
          {price
            ? `${pounds(price.price_pence)} pounds · ${duration} min with ${barber?.name ?? ""}`
            : "No price is set for this chair and service."}
          {hours ? "" : slots ? " The shop is closed that day." : ""}
          {every > 0 && lastDate
            ? ` Same time ${REPEAT_LABEL[every]} until ${shortDay(lastDate)}. Dates already taken are skipped.`
            : ""}
        </p>
        {confirmSqueeze && value !== null && (
          <div className="squeeze-box wide" role="alertdialog">
            <p>
              {clock(value)} is taken
              {overlapping.length
                ? `: ${overlapping.map((b) => customerOf(b).name).join(", ")}`
                : ""}
              . Squeeze this trim in alongside? The two show side by side in the
              diary.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="button-primary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Squeeze in
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setConfirmSqueeze(false)}
              >
                Pick another time
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="staff-error wide" role="alert">
            {error}
          </p>
        )}
        {!confirmSqueeze && (
          <div className="form-actions">
            <button
              type="submit"
              className="button-primary"
              disabled={busy || !price || value === null}
            >
              {taken ? "Squeeze in" : "Save appointment"}
            </button>
            <button type="button" className="text-button" onClick={onClose}>
              Cancel
            </button>
          </div>
        )}
      </form>
    </aside>
  );
}

export function BlockedTime({
  chairs,
  cached,
  prefill,
  busy,
  act,
  onClose,
  onSaved,
}: {
  chairs: Barber[];
  cached: Diary | null;
  prefill: BlockPrefill;
  busy: boolean;
  act: Act;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [date, setDate] = useState(prefill.date);
  const [barberId, setBarberId] = useState(
    prefill.barberId ?? chairs[0]?.id ?? "",
  );
  const [kind, setKind] = useState<"break" | "day">("break");
  const [label, setLabel] = useState("Break");
  const [from, setFrom] = useState<number | null>(prefill.minute ?? null);
  const [until, setUntil] = useState<number | null>(null);
  // A holiday: whole days from the date until this one.
  const [lastDay, setLastDay] = useState("");
  const [error, setError] = useState("");
  const day = useDay(date, cached);
  const hours = day ? hoursFor(day, date) : null;
  const [open, close] = hours ?? [540, 1080];
  const fromValue = from ?? open;
  const range = kind === "day" && lastDay > date ? lastDay : "";
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
            const result = (await act("/api/staff/diary", {
              action: "block",
              date,
              barber: barberId,
              time: wholeDay ? 0 : fromValue,
              duration: wholeDay ? 1440 : Math.max(15, untilValue - fromValue),
              label: label.trim() || (wholeDay ? "Day off" : "Break"),
              ...(range ? { until: range } : {}),
            })) as { made?: number; skipped?: number } | undefined;
            const who =
              chairs.find((b) => b.id === barberId)?.name ?? "the chair";
            const skipped = result?.skipped ?? 0;
            onSaved(
              (range
                ? `${who} is off from ${shortDay(date)} to ${shortDay(range)}: ${result?.made ?? 0} day${result?.made === 1 ? "" : "s"} blocked.`
                : wholeDay
                  ? `${dayLabel(date)} blocked for ${who}.`
                  : `Break added on ${dayLabel(date)}.`) +
                (skipped
                  ? ` ${skipped} day${skipped === 1 ? " was" : "s were"} skipped: there are bookings to move first.`
                  : ""),
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
            <option value="day">A day off, or a run of days</option>
          </select>
        </label>
        <label>
          {kind === "day" ? "First day" : "Date"}
          <input
            type="date"
            required
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        {kind === "day" && (
          <label>
            Last day (optional)
            <input
              type="date"
              min={date}
              value={lastDay}
              onChange={(e) => {
                setLastDay(e.target.value);
                if (e.target.value > date && label === "Day off")
                  setLabel("Holiday");
              }}
            />
          </label>
        )}
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
            {range
              ? "Block these days"
              : kind === "day"
                ? "Block the day"
                : "Add the break"}
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </aside>
  );
}
