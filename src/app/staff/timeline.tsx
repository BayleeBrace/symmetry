"use client";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { clock, inputTime, shopMinute, shopToday } from "@/lib/booking-data";
import {
  type Act,
  type Barber,
  type Block,
  type Booking,
  type Diary,
  OPEN_STATUSES,
  STATUS_LABEL,
  canonicalServiceName,
  customerOf,
  pounds,
  timeOptions,
  timeRange,
} from "./types";

type Selection = { kind: "booking" | "block"; id: string } | null;

export function DayTimeline({
  diary,
  barbers,
  date,
  busy,
  act,
  onWalkIn,
}: {
  diary: Diary;
  barbers: Barber[];
  date: string;
  busy: boolean;
  act: Act;
  onWalkIn: (barber: Barber, minute: number) => void;
}) {
  const [selected, setSelected] = useState<Selection>(null);
  const [chosen, setCurrent] = useState(barbers[0]?.id ?? "");
  const current = barbers.some((b) => b.id === chosen)
    ? chosen
    : (barbers[0]?.id ?? "");
  const [nowMinute, setNowMinute] = useState(() => shopMinute());
  useEffect(() => {
    const timer = setInterval(() => setNowMinute(shopMinute()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = shopToday();
  const isToday = date === today;
  const nowLine = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Open today's diary at the current time, the way a barber reaches for it.
    if (isToday) nowLine.current?.scrollIntoView({ block: "center" });
  }, [isToday, date]);

  const partBlocks = diary.blocks.filter((b) => b.duration < 1440);
  const [open, close] = diary.hours ?? [540, 1080];
  const starts = [
    open,
    ...diary.bookings.map((b) => b.start_minute),
    ...partBlocks.map((b) => b.start_minute),
  ];
  const ends = [
    close,
    ...diary.bookings.map((b) => b.start_minute + b.duration),
    ...partBlocks.map((b) => b.start_minute + b.duration),
  ];
  const start = Math.max(0, Math.floor(Math.min(...starts) / 60) * 60);
  const end = Math.min(1440, Math.ceil(Math.max(...ends) / 60) * 60);
  const rows = Math.max(4, (end - start) / 15);
  const top = (minute: number) => `calc(${(minute - start) / 15} * var(--row))`;
  const height = (duration: number) =>
    `calc(${duration / 15} * var(--row) - 2px)`;
  const hourMarks: number[] = [];
  for (let h = start; h <= end; h += 60) hourMarks.push(h);

  const selectedBooking =
    selected?.kind === "booking"
      ? diary.bookings.find((b) => b.id === selected.id)
      : undefined;
  const selectedBlock =
    selected?.kind === "block"
      ? diary.blocks.find((b) => b.id === selected.id)
      : undefined;
  const sheetOpen = Boolean(selectedBooking || selectedBlock);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const gridStyle = {
    "--rows": rows,
    "--chairs": barbers.length,
  } as CSSProperties;
  const serviceLabel = (booking: Booking) =>
    canonicalServiceName(
      diary.services.find((s) => s.id === booking.service_id)?.slug,
      booking.services?.name ?? "Trim",
    );

  return (
    <div className="day">
      {barbers.length > 1 && (
        <div className="chair-pills" aria-label="Choose a chair">
          {barbers.map((barber) => (
            <button
              key={barber.id}
              type="button"
              aria-pressed={current === barber.id}
              onClick={() => setCurrent(barber.id)}
            >
              {barber.name}
            </button>
          ))}
        </div>
      )}
      {!diary.hours && (
        <p className="day-closed">
          The shop is closed on this day. Anything shown here was added by
          staff.
        </p>
      )}
      <div className="day-grid" style={gridStyle}>
        <div className="hour-rail" aria-hidden="true">
          {hourMarks.map((h) => (
            <span key={h} style={{ top: top(h) }}>
              {clock(h)}
            </span>
          ))}
        </div>
        {barbers.map((barber) => {
          const bookings = diary.bookings.filter(
            (b) => b.barber_id === barber.id,
          );
          const active = bookings.filter((b) =>
            OPEN_STATUSES.includes(b.status),
          );
          const blocks = diary.blocks.filter((b) => b.barber_id === barber.id);
          const dayOff = blocks.find((b) => b.duration >= 1440);
          return (
            <section
              key={barber.id}
              className={`chair ${current === barber.id ? "is-current" : ""}`}
              aria-label={`${barber.name}: ${active.length} trims`}
            >
              <header className="chair-head">
                <span>{barber.name}</span>
                <small>
                  {active.length
                    ? `${active.length} trim${active.length === 1 ? "" : "s"}`
                    : "Nothing booked"}
                </small>
              </header>
              <div
                className="chair-day"
                onClick={(event) => {
                  if (event.target !== event.currentTarget || dayOff) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const rowPx = rect.height / rows;
                  const minute =
                    start +
                    Math.max(
                      0,
                      Math.floor((event.clientY - rect.top) / rowPx),
                    ) *
                      15;
                  onWalkIn(barber, Math.min(minute, end - 15));
                }}
                title="Tap a gap to add a walk-in"
              >
                {isToday && nowMinute >= start && nowMinute <= end && (
                  <div
                    className="now-line"
                    ref={barber.id === current ? nowLine : undefined}
                    style={{ top: top(nowMinute) }}
                  />
                )}
                {dayOff && (
                  <button
                    type="button"
                    className="chair-off"
                    onClick={() =>
                      setSelected({ kind: "block", id: dayOff.id })
                    }
                  >
                    {dayOff.label}
                  </button>
                )}
                {blocks
                  .filter((b) => b.duration < 1440)
                  .map((block) => (
                    <button
                      type="button"
                      className="block"
                      key={block.id}
                      style={{
                        top: top(block.start_minute),
                        height: height(block.duration),
                      }}
                      onClick={() =>
                        setSelected({ kind: "block", id: block.id })
                      }
                    >
                      <span className="trim-time">
                        {timeRange(block.start_minute, block.duration)}
                      </span>
                      <span>{block.label}</span>
                    </button>
                  ))}
                {bookings.map((booking) => {
                  const customer = customerOf(booking);
                  return (
                    <button
                      type="button"
                      className={`trim status-${booking.status} ${booking.duration <= 20 ? "is-short" : booking.duration <= 30 ? "is-compact" : ""} ${selected?.id === booking.id ? "is-selected" : ""}`}
                      key={booking.id}
                      style={{
                        top: top(booking.start_minute),
                        height: height(booking.duration),
                      }}
                      onClick={() =>
                        setSelected({ kind: "booking", id: booking.id })
                      }
                      aria-label={`${clock(booking.start_minute)} ${customer.name}, ${serviceLabel(booking)}, ${STATUS_LABEL[booking.status]}`}
                    >
                      <span className="trim-time">
                        {clock(booking.start_minute)}
                      </span>
                      <span className="trim-name">{customer.name}</span>
                      <span className="trim-service">
                        {serviceLabel(booking)}
                        {booking.late_minutes > 0
                          ? ` · late ${booking.late_minutes} min`
                          : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {sheetOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setSelected(null)} />
          {selectedBooking && (
            <BookingSheet
              booking={selectedBooking}
              serviceName={serviceLabel(selectedBooking)}
              owner={diary.staff.role === "owner"}
              busy={busy}
              act={act}
              today={today}
              onClose={() => setSelected(null)}
            />
          )}
          {selectedBlock && (
            <BlockSheet
              block={selectedBlock}
              barber={barbers.find((b) => b.id === selectedBlock.barber_id)}
              busy={busy}
              act={act}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function BookingSheet({
  booking,
  serviceName,
  owner,
  busy,
  act,
  today,
  onClose,
}: {
  booking: Booking;
  serviceName: string;
  owner: boolean;
  busy: boolean;
  act: Act;
  today: string;
  onClose: () => void;
}) {
  const customer = customerOf(booking);
  const isOpen = OPEN_STATUSES.includes(booking.status);
  const started =
    booking.local_date < today ||
    (booking.local_date === today && booking.start_minute <= shopMinute());
  const setStatus = (status: Booking["status"]) =>
    act("/api/staff/diary", {
      action: "status",
      id: booking.id,
      status,
      version: booking.updated_at,
    });
  const feeOpen = owner && ["review", "charging"].includes(booking.fee_status);
  return (
    <aside
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Booking details"
    >
      <button
        type="button"
        className="sheet-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <p className="sheet-kicker">
        {timeRange(booking.start_minute, booking.duration)} ·{" "}
        {booking.barbers?.name ?? "chair"}
      </p>
      <h2>{customer.name}</h2>
      <p className="sheet-line">
        {serviceName} · {booking.duration} min · {pounds(booking.price_pence)}{" "}
        pounds
      </p>
      <p className="sheet-status">
        <span className={`status-chip status-${booking.status}`}>
          {STATUS_LABEL[booking.status]}
        </span>
        {booking.late_minutes > 0 && (
          <span className="status-chip">
            Running {booking.late_minutes} min late
          </span>
        )}
        {booking.source === "walk_in" && (
          <span className="status-chip is-quiet">Walk-in</span>
        )}
      </p>
      {customer.preferences && (
        <p className="sheet-notes">{customer.preferences}</p>
      )}
      {(customer.phone || customer.email) && (
        <div className="sheet-contact">
          {customer.phone && (
            <a href={`tel:${customer.phone}`}>{customer.phone}</a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`}>{customer.email}</a>
          )}
        </div>
      )}
      {isOpen && (
        <>
          <div className="sheet-actions">
            {booking.status === "booked" && (
              <button
                type="button"
                className="button-primary"
                disabled={busy}
                onClick={() => void setStatus("arrived")}
              >
                In the chair
              </button>
            )}
            <button
              type="button"
              className={
                booking.status === "arrived"
                  ? "button-primary"
                  : "button-secondary"
              }
              disabled={busy || !started}
              title={
                started ? undefined : "Available once the trim has started"
              }
              onClick={() => void setStatus("done")}
            >
              Done
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy || !started}
              title={
                started ? undefined : "Available once the trim has started"
              }
              onClick={() => {
                if (confirm(`Mark ${customer.name} as a no show?`))
                  void setStatus("no_show");
              }}
            >
              No show
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => {
                if (confirm(`Cancel this trim for ${customer.name}?`))
                  void setStatus("cancelled");
              }}
            >
              Cancel trim
            </button>
          </div>
          <details className="sheet-move">
            <summary>Move this trim</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void act("/api/staff/diary", {
                  action: "move",
                  id: booking.id,
                  date: form.get("date"),
                  time: Number(form.get("time")),
                  version: booking.updated_at,
                });
              }}
            >
              <label>
                New date
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={booking.local_date}
                />
              </label>
              <label>
                New time
                <select name="time" defaultValue={booking.start_minute}>
                  {timeOptions(420, 1260).map((minute) => (
                    <option key={minute} value={minute}>
                      {clock(minute)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="button-secondary"
                disabled={busy}
              >
                Save move
              </button>
            </form>
          </details>
        </>
      )}
      {booking.fee_pence > 0 && (
        <div className="sheet-fee">
          <p>
            Fee {pounds(booking.fee_pence)} pounds ·{" "}
            {booking.fee_status.replace("_", " ")}
          </p>
          {feeOpen && (
            <div className="sheet-actions">
              <button
                type="button"
                className="button-secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      `Charge the authorised ${pounds(booking.fee_pence)} pounds fee to this customer's saved card?`,
                    )
                  )
                    void act("/api/staff/charge", {
                      action: "charge",
                      id: booking.id,
                    });
                }}
              >
                Charge fee
              </button>
              {booking.fee_status === "review" && (
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy}
                  onClick={() =>
                    void act("/api/staff/charge", {
                      action: "waive",
                      id: booking.id,
                    })
                  }
                >
                  Waive
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <p className="sheet-foot">
        Booked for {inputTime(booking.start_minute)} on {booking.local_date}
      </p>
    </aside>
  );
}

function BlockSheet({
  block,
  barber,
  busy,
  act,
  onClose,
}: {
  block: Block;
  barber?: Barber;
  busy: boolean;
  act: Act;
  onClose: () => void;
}) {
  const wholeDay = block.duration >= 1440;
  return (
    <aside
      className="sheet"
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
      <p className="sheet-kicker">
        {wholeDay ? "Whole day" : timeRange(block.start_minute, block.duration)}{" "}
        · {barber?.name ?? "chair"}
      </p>
      <h2>{block.label}</h2>
      <p className="sheet-line">
        {wholeDay
          ? "No online bookings can be made on this day."
          : "No online bookings can be made in this gap."}
      </p>
      <div className="sheet-actions">
        <button
          type="button"
          className="button-secondary"
          disabled={busy}
          onClick={() => {
            if (confirm("Remove this block?"))
              void act("/api/staff/diary", { action: "unblock", id: block.id });
          }}
        >
          Remove block
        </button>
      </div>
    </aside>
  );
}
