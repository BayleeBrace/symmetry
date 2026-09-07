"use client";
import { useState } from "react";
import { clock } from "@/lib/booking-data";
import {
  type Act,
  type Barber,
  type Diary,
  canonicalServiceName,
  dayLabel,
  pounds,
  timeOptions,
} from "./types";

export type WalkInPrefill = { barberId: string; minute: number } | null;

export function WalkInForm({
  diary,
  barbers,
  date,
  prefill,
  busy,
  act,
}: {
  diary: Diary;
  barbers: Barber[];
  date: string;
  prefill: WalkInPrefill;
  busy: boolean;
  act: Act;
}) {
  const [open, close] = diary.hours ?? [540, 1080];
  const [barberId, setBarberId] = useState(
    prefill?.barberId ?? barbers[0]?.id ?? "",
  );
  const [serviceId, setServiceId] = useState(diary.services[0]?.id ?? "");
  const [time, setTime] = useState(prefill?.minute ?? open);
  const [saved, setSaved] = useState("");
  const barber = barbers.find((b) => b.id === barberId);
  const service = diary.services.find((s) => s.id === serviceId);
  const price = diary.prices.find(
    (p) => p.barber_id === barberId && p.service_id === serviceId,
  );
  const options = timeOptions(
    Math.min(open, time),
    Math.max(close - (price?.duration ?? 15), time),
  );
  return (
    <section className="staff-panel">
      <h2>Add a trim.</h2>
      <p>
        A walk-in for {dayLabel(date)}. It goes straight into the diary, so
        online bookings cannot take the same time.
      </p>
      <form
        className="staff-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          if (!barber || !service) return;
          setSaved("");
          await act("/api/staff/diary", {
            action: "walkin",
            date,
            time,
            name: data.get("name"),
            email: data.get("email") || "",
            phone: data.get("phone") || "",
            barber: barber.slug,
            service: service.slug,
          });
          form.reset();
          setSaved(`Added ${data.get("name")} at ${clock(time)}.`);
        }}
      >
        <label className="wide">
          Customer
          <input name="name" required minLength={2} autoComplete="off" />
        </label>
        <label>
          Mobile (optional)
          <input name="phone" type="tel" inputMode="tel" autoComplete="off" />
        </label>
        <label>
          Email (optional)
          <input name="email" type="email" autoComplete="off" />
        </label>
        <label>
          Barber
          <select
            value={barberId}
            onChange={(event) => setBarberId(event.target.value)}
          >
            {barbers.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Service
          <select
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
          >
            {diary.services.map((s) => (
              <option value={s.id} key={s.id}>
                {canonicalServiceName(s.slug, s.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Time
          <select
            value={time}
            onChange={(event) => setTime(Number(event.target.value))}
          >
            {options.map((minute) => (
              <option key={minute} value={minute}>
                {clock(minute)}
              </option>
            ))}
          </select>
        </label>
        <p className="price-hint">
          {price
            ? `${pounds(price.price_pence)} pounds · ${price.duration} min with ${barber?.name ?? ""}`
            : "No price is set for this barber and service."}
        </p>
        <div className="form-actions">
          <button
            type="submit"
            className="button-primary"
            disabled={busy || !price}
          >
            Add to diary
          </button>
          {saved && <span className="form-note">{saved}</span>}
        </div>
      </form>
    </section>
  );
}

export function BreakForm({
  barbers,
  date,
  hours,
  busy,
  act,
}: {
  barbers: Barber[];
  date: string;
  hours: [number, number] | null;
  busy: boolean;
  act: Act;
}) {
  const [open, close] = hours ?? [540, 1080];
  const [kind, setKind] = useState<"break" | "day">("break");
  const [from, setFrom] = useState(open);
  const [until, setUntil] = useState(Math.min(close, open + 60));
  const [saved, setSaved] = useState("");
  const untilOptions = timeOptions(from + 15, Math.max(close, from + 15));
  return (
    <section className="staff-panel">
      <h2>Make some space.</h2>
      <p>
        Block a break on {dayLabel(date)}, or take the whole day off for a
        holiday. Move any existing bookings first.
      </p>
      <form
        className="staff-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const wholeDay = kind === "day";
          setSaved("");
          await act("/api/staff/diary", {
            action: "block",
            date,
            barber: data.get("barber"),
            time: wholeDay ? 0 : from,
            duration: wholeDay ? 1440 : Math.max(15, until - from),
            label: data.get("label") || (wholeDay ? "Day off" : "Break"),
          });
          setSaved(wholeDay ? "Day blocked." : "Break added.");
        }}
      >
        <label>
          Barber
          <select name="barber">
            {barbers.map((b) => (
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
            onChange={(event) =>
              setKind(event.target.value === "day" ? "day" : "break")
            }
          >
            <option value="break">A break</option>
            <option value="day">The whole day</option>
          </select>
        </label>
        <label className="wide">
          Label
          <input
            name="label"
            key={kind}
            defaultValue={kind === "day" ? "Day off" : "Break"}
            maxLength={80}
          />
        </label>
        {kind === "break" && (
          <>
            <label>
              From
              <select
                value={from}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setFrom(next);
                  if (until <= next) setUntil(next + 15);
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
                value={until}
                onChange={(event) => setUntil(Number(event.target.value))}
              >
                {untilOptions.map((minute) => (
                  <option key={minute} value={minute}>
                    {clock(minute)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={busy}>
            {kind === "day" ? "Block the day" : "Add the break"}
          </button>
          {saved && <span className="form-note">{saved}</span>}
        </div>
      </form>
    </section>
  );
}
