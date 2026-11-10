"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import {
  addDays,
  clock,
  parseDate,
  shopMinute,
  shopToday,
} from "@/lib/booking-data";
import { clashes, soonestStart, startChoices } from "@/lib/squeeze";
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
  displayPhone,
  freeTimes,
  hoursFor,
  initials,
  pounds,
  shortDay,
  timeOptions,
} from "./types";
import type { BookPrefill } from "./calendar";
import { useDialog } from "./dialog";
import { SheetIcon } from "./timeline";

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

/** Online and staff bookings both open this many days ahead; the database refuses later dates. */
const HORIZON_DAYS = 120;

function daysBetween(from: string, to: string) {
  return Math.round(
    (parseDate(to).getTime() - parseDate(from).getTime()) / 86400000,
  );
}

const REPEAT_LABEL: Record<number, string> = {
  1: "every week",
  2: "every 2 weeks",
  3: "every 3 weeks",
  4: "every 4 weeks",
};

/**
 * The diary for one day: the calendar's copy when it covers the day, else
 * fetched. A failed fetch says so and can be tried again.
 */
function useDay(date: string, cached: Diary | null) {
  const covered = Boolean(
    cached &&
    date >= cached.date &&
    date <= (cached.to ?? cached.date) &&
    (cached.hoursByDay ? date in cached.hoursByDay : cached.date === date),
  );
  const [fetched, setFetched] = useState<{
    date: string;
    diary: Diary | null;
    error: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (covered) return;
    let live = true;
    api("/api/staff/diary?date=" + date)
      .then((d) => {
        if (live) setFetched({ date, diary: d as Diary, error: "" });
      })
      .catch((e) => {
        if (live)
          setFetched({
            date,
            diary: null,
            error: (e as Error).message || "The diary could not load.",
          });
      });
    return () => {
      live = false;
    };
  }, [date, covered, attempt]);
  const retry = () => {
    setFetched(null);
    setAttempt((n) => n + 1);
  };
  if (covered) return { day: cached, error: "", retry };
  const current = fetched?.date === date ? fetched : null;
  return { day: current?.diary ?? null, error: current?.error ?? "", retry };
}

/** The diary could not be read: say so, and offer another go. */
function DayError({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="staff-error wide day-error" role="alert">
      Could not check the diary for that day.{" "}
      <button type="button" className="text-button" onClick={onRetry}>
        Try again
      </button>
    </p>
  );
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
  const [serviceId, setServiceId] = useState(
    prefill.serviceId ?? ctx.services[0]?.id ?? "",
  );
  const [date, setDate] = useState(prefill.date ?? shopToday());
  const [time, setTime] = useState<number | null>(prefill.minute ?? null);
  const [name, setName] = useState(prefill.client?.name ?? "");
  const [email, setEmail] = useState(prefill.client?.email ?? "");
  const [phone, setPhone] = useState(prefill.client?.phone ?? "");
  const [picked, setPicked] = useState<Client | null>(
    prefill.client ? { ...prefill.client, id: prefill.client.id ?? "" } : null,
  );
  const [results, setResults] = useState<Client[]>([]);
  const [every, setEvery] = useState(0);
  const [times, setTimes] = useState(4);
  const [confirmSqueeze, setConfirmSqueeze] = useState(false);
  const [error, setError] = useState("");
  // Date, time and chair fold into one line when they came from a tap on the diary.
  const [whenOpen, setWhenOpen] = useState(prefill.minute == null);
  const [allServices, setAllServices] = useState(false);
  const { day, error: dayError, retry } = useDay(date, cached);
  const walkIn = picked?.name === WALK_IN;
  const ref = useDialog<HTMLElement>(onClose);

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
  // Only what this chair offers: a price switched off as "Not offered" is not bookable.
  const offeredPrice = (id: string) =>
    ctx.prices.find(
      (p) =>
        p.barber_id === barberId && p.service_id === id && p.active !== false,
    );
  const offered = ctx.services.filter((s) => offeredPrice(s.id));
  const serviceValue = offered.some((s) => s.id === serviceId)
    ? serviceId
    : (offered[0]?.id ?? "");
  const service = offered.find((s) => s.id === serviceValue);
  const price = offeredPrice(serviceValue);
  const duration = price?.duration ?? 30;
  const slots = day ? freeTimes(day, date, barberId, duration) : null;
  const hours = day ? hoursFor(day, date) : null;
  const working = day ? chairHours(day, date, barberId) : null;
  // Every quarter hour the chair is working, taken ones included: staff can
  // squeeze a trim in. Today starts from the next five minutes, so a walk-in
  // can start now; a time that has gone would be refused.
  const inHours =
    working && !slots?.closed
      ? startChoices({
          working,
          duration,
          isToday: date === shopToday(),
          nowMinute: shopMinute(),
          asked: time,
        })
      : [];
  // What's already in this chair that day: open trims and blocked time.
  const busySpans: [number, number][] = day
    ? [
        ...day.bookings.filter(
          (b) =>
            (!b.local_date || b.local_date === date) &&
            b.barber_id === barberId &&
            OPEN_STATUSES.includes(b.status),
        ),
        ...day.blocks.filter(
          (b) =>
            (!b.local_date || b.local_date === date) &&
            b.barber_id === barberId &&
            b.duration < 1440,
        ),
      ].map((b) => [b.start_minute, b.start_minute + b.duration])
    : [];
  // A time from outside the chair's hours is only kept on a day the chair is
  // not working (staff adding to a closed day). On a working day it moves to
  // the nearest start that still finishes in time.
  const choices = slots
    ? time === null || inHours.includes(time) || inHours.length > 0
      ? inHours
      : [...inHours, time].sort((a, b) => a - b)
    : time !== null
      ? [time]
      : [];
  const value =
    time !== null && choices.length
      ? choices.reduce((best, m) =>
          Math.abs(m - time) < Math.abs(best - time) ? m : best,
        )
      : (choices[0] ?? null);
  const moved = time !== null && value !== null && value !== time && !!slots;
  const taken =
    value !== null && slots ? clashes(busySpans, value, duration) : false;
  // When the time is taken, the next one that's clear, in case it can wait.
  const nextClear =
    taken && value !== null
      ? choices.find((m) => m > value && !clashes(busySpans, m, duration))
      : undefined;
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
  // Repeats stop at the 120 days the diary opens ahead.
  const horizon = addDays(shopToday(), HORIZON_DAYS);
  const fits =
    every > 0
      ? Math.min(12, Math.floor(daysBetween(date, horizon) / (every * 7)) + 1)
      : 0;
  const repeatTimes = Math.min(times, fits);
  const repeating = every > 0 && repeatTimes >= 2;
  const lastDate = repeating
    ? addDays(date, (repeatTimes - 1) * every * 7)
    : undefined;
  // A client picked from the list is booked onto their own record, unless their details were changed here.
  const sameClient =
    picked &&
    picked.id &&
    !walkIn &&
    name.trim() === picked.name.trim() &&
    email.trim() === (picked.email ?? "").trim() &&
    phone.trim() === (picked.phone ?? "").trim()
      ? picked.id
      : undefined;

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
        ...(sameClient ? { customer_id: sameClient } : {}),
        ...(squeeze ? { squeeze: true } : {}),
        ...(repeating ? { repeat: { every, times: repeatTimes } } : {}),
      })) as { made?: number; skipped?: number; beyond?: number } | undefined;
      const made = result?.made ?? 1;
      const skipped = result?.skipped ?? 0;
      const beyond = result?.beyond ?? 0;
      let message = `Added ${name.trim()} with ${barber.name} at ${clock(value)} on ${dayLabel(date)}`;
      if (repeating && made > 1)
        message += `, and ${made - 1} more ${REPEAT_LABEL[every]}`;
      message += ".";
      if (skipped > 0)
        message += ` ${skipped} of the repeat dates ${skipped === 1 ? "was" : "were"} unavailable and skipped.`;
      if (beyond > 0)
        message += ` ${beyond} ${beyond === 1 ? "date was" : "dates were"} past the ${HORIZON_DAYS} days the diary opens ahead, so not added.`;
      onSaved(message);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const serviceRows = offered.filter(
    (s, i) =>
      allServices || offered.length <= 5 || i < 4 || s.id === serviceValue,
  );
  const hiddenServices = offered.length - serviceRows.length;
  const newClient = !picked && name.trim().length >= 2;

  return (
    <aside
      ref={ref}
      className="sheet drawer new-appointment"
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
        <SheetIcon d="M6 6l12 12M18 6L6 18" />
      </button>
      <h2>New appointment</h2>
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
        <button
          type="button"
          className="when-row wide"
          aria-expanded={whenOpen}
          onClick={() => setWhenOpen((o) => !o)}
        >
          <SheetIcon d="M3.5 5h17v15h-17zM3.5 10h17M8 3v4M16 3v4" />
          <span className="when-text">
            {shortDay(date)} ·{" "}
            {value !== null
              ? clock(value)
              : slots
                ? slots.closed
                  ? "Closed"
                  : "No times"
                : "Checking…"}{" "}
            · {barber?.name ?? "Chair"}
          </span>
          <span className="when-change">{whenOpen ? "Done" : "Change"}</span>
        </button>
        {(moved || taken) && value !== null && (
          <p className="when-note wide">
            {moved && time !== null
              ? date === shopToday() && time < soonestStart(shopMinute())
                ? `${clock(time)} has gone, so this starts at ${clock(value)}. `
                : `${clock(time)} would run past ${barber?.name ?? "the chair"}’s hours, so this starts at ${clock(value)}. `
              : ""}
            {taken
              ? `${clock(value)} is taken: this will be squeezed in alongside.`
              : ""}
            {nextClear !== undefined && (
              <button
                type="button"
                className="text-button when-next"
                onClick={() => {
                  setTime(nextClear);
                  setConfirmSqueeze(false);
                }}
              >
                Or the next free time, {clock(nextClear)}
              </button>
            )}
          </p>
        )}
        {whenOpen && (
          <div className="when-fields wide">
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
                max={horizon}
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
                {!slots && (
                  <option value="">
                    {dayError
                      ? "Could not check the diary"
                      : "Checking the diary…"}
                  </option>
                )}
                {slots && choices.length === 0 && (
                  <option value="">
                    {slots.closed ? "Closed that day" : "No times today"}
                  </option>
                )}
                {choices.map((minute) => (
                  <option key={minute} value={minute}>
                    {clock(minute)}
                    {slots && clashes(busySpans, minute, duration)
                      ? " (taken, squeeze in)"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {dayError && <DayError onRetry={retry} />}

        <div className="wide client-block">
          <span className="field-label">Client</span>
          {picked ? (
            <div className="client-picked">
              <span className="avatar">{initials(picked.name)}</span>
              <span className="client-picked-text">
                <strong>{picked.name}</strong>
                <small>
                  {walkIn
                    ? "Walk-in, no details needed"
                    : picked.phone
                      ? displayPhone(picked.phone)
                      : picked.email || "Existing client"}
                </small>
              </span>
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
                Change
              </button>
            </div>
          ) : (
            <label className="client-field">
              <span className="sr-only">Client name</span>
              <span className="search-box">
                <SheetIcon d="M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM16 16l4.5 4.5" />
                <input
                  value={name}
                  required
                  minLength={2}
                  autoComplete="off"
                  placeholder="Name, mobile or email"
                  onChange={(e) => {
                    setName(e.target.value);
                    setPicked(null);
                  }}
                />
              </span>
              {name.trim().length >= 2 && results.length > 0 && (
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
                            {c.phone
                              ? displayPhone(c.phone)
                              : c.email || "No contact details"}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
          )}
          {!picked && (
            <div className="client-quick">
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
            </div>
          )}
          {newClient && (
            <div className="new-client-fields">
              <p className="field-hint">
                New client? Add a mobile or email so they get reminders.
              </p>
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
            </div>
          )}
        </div>

        <fieldset className="wide service-list">
          <legend className="field-label">Service</legend>
          {offered.length === 0 && (
            <p className="staff-muted">Nothing is offered on this chair.</p>
          )}
          {serviceRows.map((s) => {
            const p = offeredPrice(s.id);
            return (
              <label key={s.id} className="service-option">
                <input
                  type="radio"
                  name="service"
                  value={s.id}
                  checked={s.id === serviceValue}
                  onChange={() => setServiceId(s.id)}
                />
                <span className="service-name">
                  {canonicalServiceName(s.slug, s.name)}
                </span>
                <span className="service-mins">{p?.duration ?? 30} min</span>
                <span className="service-price">
                  {p ? `£${pounds(p.price_pence)}` : ""}
                </span>
              </label>
            );
          })}
          {hiddenServices > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={() => setAllServices(true)}
            >
              All services ({offered.length})
            </button>
          )}
        </fieldset>

        <label className="wide row-field">
          <span>Repeat</span>
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
        {every > 0 && fits >= 2 && (
          <label className="wide row-field">
            <span>How many times</span>
            <select
              value={repeatTimes}
              onChange={(e) => setTimes(Number(e.target.value))}
            >
              {Array.from({ length: fits - 1 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} times
                </option>
              ))}
            </select>
          </label>
        )}
        {(!price ||
          (!hours && slots) ||
          (repeating && lastDate) ||
          (every > 0 && fits < 12)) && (
          <p className="price-hint">
            {price ? "" : "No price is set for this chair and service."}
            {hours ? "" : slots ? " The shop is closed that day." : ""}
            {repeating && lastDate
              ? ` Same time ${REPEAT_LABEL[every]} until ${shortDay(lastDate)}. Dates already taken are skipped.`
              : ""}
            {every > 0 && fits < 12
              ? fits >= 2
                ? ` The diary opens ${HORIZON_DAYS} days ahead, so up to ${fits} times fit.`
                : ` The diary opens ${HORIZON_DAYS} days ahead, so no repeat fits after this date.`
              : ""}
          </p>
        )}
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
          <div className="form-actions sheet-cta">
            <button
              type="submit"
              className="button-primary"
              disabled={busy || !price || value === null}
            >
              {taken ? "Squeeze in" : "Book"}
              {price ? ` · £${pounds(price.price_pence)}` : ""}
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
  const { day, error: dayError, retry } = useDay(date, cached);
  const hours = day ? hoursFor(day, date) : null;
  const ref = useDialog<HTMLElement>(onClose);
  const [open, close] = hours ?? [540, 1080];
  const fromValue = from ?? open;
  const range = kind === "day" && lastDay > date ? lastDay : "";
  const untilValue = until ?? Math.min(close, fromValue + 60);
  return (
    <aside
      ref={ref}
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
        {dayError && <DayError onRetry={retry} />}
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

export type Waiting = {
  id: string;
  date: string;
  until: string | null;
  barber_id: string | null;
  barber: string | null;
  service: string;
  name: string;
  phone: string;
  email: string;
  offered: boolean;
};

/** One person waiting, with a Remove link. Used in the drawer and under Clients. */
export function WaitingRow({
  w,
  busy,
  onRemove,
  showDay,
}: {
  w: Waiting;
  busy: boolean;
  onRemove: (id: string) => void;
  showDay?: boolean;
}) {
  return (
    <li>
      <span className="avatar">{initials(w.name)}</span>
      <span className="wait-body">
        <strong>{w.name}</strong>
        <small>
          {showDay
            ? `${shortDay(w.date)}${w.until ? ` to ${shortDay(w.until)}` : ""} · `
            : w.until
              ? `Any day to ${shortDay(w.until)} · `
              : ""}
          {w.service} with {w.barber ?? "any chair"}
          {w.phone ? ` · ${w.phone}` : w.email ? ` · ${w.email}` : ""}
          {w.offered ? " · offered a slot" : ""}
        </small>
      </span>
      <button
        type="button"
        className="text-button"
        disabled={busy}
        onClick={() => onRemove(w.id)}
      >
        Remove
      </button>
    </li>
  );
}

/** Put someone on the waitlist for a day (or a run of days), and see who is already waiting. */
export function WaitlistForm({
  ctx,
  chairs,
  date: initialDate,
  busy,
  act,
  onClose,
  onSaved,
}: {
  ctx: Context;
  chairs: Barber[];
  date: string;
  busy: boolean;
  act: Act;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [until, setUntil] = useState("");
  const [barberId, setBarberId] = useState("");
  const [serviceId, setServiceId] = useState(ctx.services[0]?.id ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<Client | null>(null);
  const [results, setResults] = useState<Client[]>([]);
  const [waiting, setWaiting] = useState<Waiting[] | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const ref = useDialog<HTMLElement>(onClose);

  useEffect(() => {
    let live = true;
    api("/api/staff/waitlist?date=" + date)
      .then((d) => {
        if (live) setWaiting(d.waiting as Waiting[]);
      })
      .catch(() => {
        if (live) setWaiting([]);
      });
    return () => {
      live = false;
    };
  }, [date, tick]);

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

  const remove = async (id: string) => {
    try {
      await act("/api/staff/waitlist", { action: "remove", id });
      setTick((t) => t + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <aside
      ref={ref}
      className="sheet drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Waitlist"
    >
      <button
        type="button"
        className="sheet-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <h2>Waitlist.</h2>
      <p className="sheet-line">
        For when the day is full. When a slot frees up they are offered it, one
        person at a time, by text where we have a mobile.
      </p>
      <form
        className="staff-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          try {
            await act("/api/staff/waitlist", {
              action: "add",
              date,
              ...(until > date ? { until } : {}),
              barber: barberId || null,
              service: serviceId,
              name: name.trim(),
              phone: phone.trim(),
              email: email.trim(),
            });
            setName("");
            setPhone("");
            setEmail("");
            setPicked(null);
            setTick((t) => t + 1);
            onSaved(
              `${name.trim()} is on the list for ${dayLabel(date)}${until > date ? ` to ${shortDay(until)}` : ""}.`,
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
          Mobile
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
          From
          <input
            type="date"
            required
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>
        <label>
          Until (optional)
          <input
            type="date"
            min={date}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
        <label>
          Chair
          <select
            value={barberId}
            onChange={(e) => setBarberId(e.target.value)}
          >
            <option value="">Any chair</option>
            {chairs.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trim
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
        {error && (
          <p className="staff-error wide" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            type="submit"
            className="button-primary"
            disabled={busy || (!phone.trim() && !email.trim())}
          >
            Put them on the list
          </button>
          <button type="button" className="text-button" onClick={onClose}>
            Close
          </button>
        </div>
      </form>
      <h3 className="wait-heading">
        Waiting for {shortDay(date)}
        {waiting ? ` (${waiting.length})` : ""}
      </h3>
      {!waiting ? (
        <p className="staff-muted">Checking…</p>
      ) : waiting.length === 0 ? (
        <p className="staff-muted">Nobody yet.</p>
      ) : (
        <ul className="wait-list">
          {waiting.map((w) => (
            <WaitingRow key={w.id} w={w} busy={busy} onRemove={remove} />
          ))}
        </ul>
      )}
    </aside>
  );
}
