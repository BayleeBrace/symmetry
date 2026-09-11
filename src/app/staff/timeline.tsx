"use client";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { clock, inputTime, shopMinute, shopToday } from "@/lib/booking-data";
import { staffApi as api } from "@/lib/staff-client";
import {
  type Act,
  type Barber,
  type Block,
  type Booking,
  type Diary,
  type PaidBy,
  OPEN_STATUSES,
  PAID_LABEL,
  STATUS_LABEL,
  canonicalServiceName,
  chairHours,
  customerOf,
  freeTimes,
  initials,
  laneLayout,
  pounds,
  serviceTint,
  shortDay,
  timeRange,
} from "./types";
import { attachDrag, type DragDrop } from "./drag";
import { toast } from "./toast";

type Selection = { kind: "booking" | "block"; id: string } | null;
/** Where the "select time" plus sits: a chair and a start minute. */
export type Placement = { barberId: string; minute: number };
const PLACE_MINUTES = 30;
/** A trim's share of the column when it overlaps others. */
export type Lane = { lane: number; lanes: number } | undefined;

function laneStyle(lane: Lane): CSSProperties {
  if (!lane || lane.lanes <= 1) return {};
  return {
    left: `calc(${(lane.lane / lane.lanes) * 100}% + ${lane.lane ? 2 : 0}px)`,
    right: "auto",
    width: `calc(${100 / lane.lanes}% - ${lane.lane ? 2 : 0}px)`,
  };
}
export type HistoryView = {
  visits: number;
  noShows: number;
  last: string | null;
};

export function serviceLabel(diary: Diary, booking: Booking) {
  return canonicalServiceName(
    diary.services.find((s) => s.id === booking.service_id)?.slug,
    booking.services?.name ?? "Trim",
  );
}

export function historyView(
  diary: Diary,
  booking: Booking,
): HistoryView | undefined {
  const id = booking.booking_groups?.customer_id;
  const h = id ? diary.history?.[id] : undefined;
  if (!h) return undefined;
  const last = h.last
    ? `${canonicalServiceName(
        diary.services.find((s) => s.id === h.last?.service_id)?.slug,
        "Trim",
      )} with ${
        diary.barbers.find((b) => b.id === h.last?.barber_id)?.name ?? "us"
      }, ${shortDay(h.last.date)}`
    : null;
  return { visits: h.visits, noShows: h.noShows, last };
}

/** One appointment block in the calendar, coloured by service. Draggable while open. */
export function TrimCard({
  booking,
  service,
  tint,
  selected,
  top,
  height,
  lane,
  onClick,
}: {
  booking: Booking;
  service: string;
  tint: number;
  selected: boolean;
  top: string;
  height: string;
  lane?: Lane;
  onClick: () => void;
}) {
  const customer = customerOf(booking);
  const open = OPEN_STATUSES.includes(booking.status);
  return (
    <button
      type="button"
      className={`trim svc-${tint} status-${booking.status} ${booking.duration <= 20 ? "is-short" : booking.duration <= 30 ? "is-compact" : ""} ${selected ? "is-selected" : ""} ${lane && lane.lanes > 1 ? "is-lane" : ""}`}
      style={{ top, height, ...laneStyle(lane) }}
      data-id={booking.id}
      data-version={booking.updated_at}
      data-start={booking.start_minute}
      data-duration={booking.duration}
      data-open={open ? "1" : "0"}
      onClick={onClick}
      aria-label={`${clock(booking.start_minute)} ${customer.name}, ${service}, ${STATUS_LABEL[booking.status]}`}
    >
      <span className="trim-time">
        {timeRange(booking.start_minute, booking.duration)}
        {booking.status === "done" ? " ✓" : ""}
        {booking.late_minutes > 0 ? ` · late ${booking.late_minutes}` : ""}
      </span>
      <span className="trim-name">{customer.name}</span>
      <span className="trim-service">{service}</span>
    </button>
  );
}

/** Hatched time a chair is not working, so nobody books into it by mistake. */
export function OffHours({
  hours,
  start,
  end,
  top,
  height,
}: {
  hours: [number, number] | null;
  start: number;
  end: number;
  top: (minute: number) => string;
  height: (duration: number) => string;
}) {
  if (!hours)
    return (
      <div className="off-hours is-whole" aria-hidden="true">
        Off today
      </div>
    );
  return (
    <>
      {hours[0] > start && (
        <div
          className="off-hours"
          aria-hidden="true"
          style={{ top: top(start), height: height(hours[0] - start) }}
        />
      )}
      {hours[1] < end && (
        <div
          className="off-hours"
          aria-hidden="true"
          style={{ top: top(hours[1]), height: height(end - hours[1]) }}
        />
      )}
    </>
  );
}

export function DayTimeline({
  diary,
  barbers,
  date,
  busy,
  act,
  onMove,
  onWalkIn,
  placement,
  onPlace,
  onPlaceDone,
  onRebook,
}: {
  diary: Diary;
  barbers: Barber[];
  date: string;
  busy: boolean;
  act: Act;
  onMove: (drop: DragDrop) => void;
  onWalkIn: (barber: Barber, minute: number) => void;
  placement?: Placement | null;
  onPlace?: (barberId: string, minute: number) => void;
  onPlaceDone?: () => void;
  onRebook?: (booking: Booking) => void;
}) {
  const [selected, setSelected] = useState<Selection>(null);
  const [behind, setBehind] = useState<string | null>(null);
  const [nowMinute, setNowMinute] = useState(() => shopMinute());
  useEffect(() => {
    const timer = setInterval(() => setNowMinute(shopMinute()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = shopToday();
  const isToday = date === today;
  const own =
    barbers.find((b) => b.id === diary.staff.barber_id)?.id ?? barbers[0]?.id;
  const nowLine = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Open today's diary at the current time, the way a barber reaches for it.
    if (isToday) nowLine.current?.scrollIntoView({ block: "center" });
  }, [isToday, date]);

  const bookingsToday = diary.bookings.filter(
    (b) => !b.local_date || b.local_date === date,
  );
  const blocksToday = diary.blocks.filter(
    (b) => !b.local_date || b.local_date === date,
  );
  const partBlocks = blocksToday.filter((b) => b.duration < 1440);
  const [open, close] = diary.hours ?? [540, 1080];
  const starts = [
    open,
    ...bookingsToday.map((b) => b.start_minute),
    ...partBlocks.map((b) => b.start_minute),
  ];
  const ends = [
    close,
    ...bookingsToday.map((b) => b.start_minute + b.duration),
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

  // Drag a trim to another time or chair. Handlers live in refs so a refresh mid-drag does not tear it down.
  // The "select time" plus is dragged the same way and reports as id "new".
  const gridRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<(drop: DragDrop) => void>(() => {});
  const placeRef = useRef<(barberId: string, minute: number) => void>(() => {});
  const busyRef = useRef(busy);
  useEffect(() => {
    dropRef.current = onMove;
    placeRef.current = onPlace ?? (() => {});
    busyRef.current = busy;
  });
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    return attachDrag(el, {
      start,
      end,
      rows,
      columns: () =>
        [...el.querySelectorAll<HTMLElement>(".chair-day[data-key]")].map(
          (column) => ({ key: column.dataset.key ?? "", el: column }),
        ),
      canDrag: (card) =>
        card.dataset.id === "new" ||
        (card.dataset.open === "1" && !busyRef.current),
      onDrop: (drop) =>
        drop.id === "new"
          ? placeRef.current(drop.column, drop.minute)
          : dropRef.current(drop),
    });
  }, [start, end, rows]);

  const selectedBooking =
    selected?.kind === "booking"
      ? bookingsToday.find((b) => b.id === selected.id)
      : undefined;
  const selectedBlock =
    selected?.kind === "block"
      ? blocksToday.find((b) => b.id === selected.id)
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

  const nextUp = isToday
    ? bookingsToday
        .filter(
          (b) =>
            b.barber_id === own &&
            OPEN_STATUSES.includes(b.status) &&
            b.start_minute + b.duration > nowMinute,
        )
        .sort((a, b) => a.start_minute - b.start_minute)[0]
    : undefined;

  return (
    <div className="day">
      <div className="day-sticky">
        {nextUp && (
          <button
            type="button"
            className="next-up"
            onClick={() => setSelected({ kind: "booking", id: nextUp.id })}
          >
            <span className="next-up-label">
              {nextUp.status === "arrived" ? "In the chair" : "Next"}
            </span>
            <span className="next-up-body">
              {clock(nextUp.start_minute)} · {customerOf(nextUp).name} ·{" "}
              {serviceLabel(diary, nextUp)}
            </span>
          </button>
        )}
      </div>
      {!diary.hours && (
        <p className="day-closed">
          The shop is closed on this day. Anything shown here was added by
          staff.
        </p>
      )}
      <div className="day-grid" style={gridStyle} ref={gridRef}>
        {isToday && nowMinute >= start && nowMinute <= end && (
          <div
            className="now-bar"
            ref={nowLine}
            style={{
              top: `calc(var(--head) + ${(nowMinute - start) / 15} * var(--row))`,
            }}
            aria-hidden="true"
          >
            <span>{clock(nowMinute)}</span>
          </div>
        )}
        <div className="hour-rail" aria-hidden="true">
          {hourMarks.map((h) => (
            <span key={h} style={{ top: top(h) }}>
              {clock(h)}
            </span>
          ))}
          {placement && (
            <span className="place-time" style={{ top: top(placement.minute) }}>
              {clock(placement.minute)}
            </span>
          )}
        </div>
        {barbers.map((barber) => {
          const bookings = bookingsToday.filter(
            (b) => b.barber_id === barber.id,
          );
          const lanes = laneLayout(bookings);
          const active = bookings.filter((b) =>
            OPEN_STATUSES.includes(b.status),
          );
          const blocks = blocksToday.filter((b) => b.barber_id === barber.id);
          const dayOff = blocks.find((b) => b.duration >= 1440);
          const hours = chairHours(diary, date, barber.id);
          const upcoming = isToday
            ? active.filter(
                (b) =>
                  b.status === "booked" &&
                  b.start_minute + b.duration > nowMinute,
              )
            : [];
          return (
            <section
              key={barber.id}
              className={`chair ${own === barber.id ? "is-own" : ""}`}
              aria-label={`${barber.name}: ${active.length} trims`}
            >
              <header className="chair-head">
                <span className="avatar">{initials(barber.name)}</span>
                <span className="chair-name">{barber.name}</span>
                <small>
                  {active.length
                    ? `${active.length} trim${active.length === 1 ? "" : "s"}`
                    : "Nothing booked"}
                </small>
                {upcoming.length > 0 && (
                  <button
                    type="button"
                    className="chair-behind-toggle"
                    aria-expanded={behind === barber.id}
                    aria-label={`${barber.name} running behind?`}
                    onClick={() =>
                      setBehind(behind === barber.id ? null : barber.id)
                    }
                  >
                    <span className="behind-long">Running behind?</span>
                    <span className="behind-short">Late?</span>
                  </button>
                )}
              </header>
              {behind === barber.id && (
                <div className="chair-behind">
                  <p>
                    Tell the next{" "}
                    {upcoming.length === 1 ? "customer" : "two customers"} how
                    far behind {barber.name} is running.
                  </p>
                  <div className="chair-behind-options">
                    {[10, 15, 20, 30].map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className="button-secondary"
                        disabled={busy}
                        onClick={async () => {
                          const result = (await act("/api/staff/diary", {
                            action: "running_behind",
                            barber: barber.id,
                            minutes,
                          })) as { told?: number } | undefined;
                          setBehind(null);
                          if (!result) return;
                          toast(
                            result.told
                              ? `Told ${
                                  result.told === 1
                                    ? "the next customer"
                                    : `the next ${result.told} customers`
                                } that ${barber.name} is running about ${minutes} minutes behind.`
                              : "No one to tell: the next customers have no phone or email on file.",
                          );
                        }}
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div
                className="chair-day"
                data-key={barber.id}
                onClick={(event) => {
                  if (event.target !== event.currentTarget || dayOff || !hours)
                    return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const rowPx = rect.height / rows;
                  const minute =
                    start +
                    Math.max(
                      0,
                      Math.floor((event.clientY - rect.top) / rowPx),
                    ) *
                      15;
                  if (placement && onPlace) {
                    onPlace(
                      barber.id,
                      Math.min(minute, Math.max(start, end - PLACE_MINUTES)),
                    );
                    return;
                  }
                  onWalkIn(barber, Math.min(minute, end - 15));
                }}
                title={
                  placement
                    ? "Tap where the new appointment goes."
                    : "Tap a gap to add an appointment. Hold a trim to move it."
                }
              >
                {!dayOff && (
                  <OffHours
                    hours={hours}
                    start={start}
                    end={end}
                    top={top}
                    height={height}
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
                {bookings.map((booking) => (
                  <TrimCard
                    key={booking.id}
                    booking={booking}
                    service={serviceLabel(diary, booking)}
                    tint={serviceTint(diary, booking.service_id)}
                    selected={selected?.id === booking.id}
                    top={top(booking.start_minute)}
                    height={height(booking.duration)}
                    lane={lanes.get(booking.id)}
                    onClick={() =>
                      setSelected({ kind: "booking", id: booking.id })
                    }
                  />
                ))}
                {placement?.barberId === barber.id && (
                  <button
                    type="button"
                    className="trim place-card"
                    style={{
                      top: top(placement.minute),
                      height: height(PLACE_MINUTES),
                    }}
                    data-id="new"
                    data-version=""
                    data-start={placement.minute}
                    data-duration={PLACE_MINUTES}
                    data-open="1"
                    onClick={onPlaceDone}
                    aria-label={`New appointment with ${barber.name} at ${clock(placement.minute)}. Drag to change the time, tap to carry on.`}
                  >
                    <span className="place-plus" aria-hidden="true">
                      +
                    </span>
                    <span className="place-when">
                      {clock(placement.minute)}
                    </span>
                  </button>
                )}
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
              diary={diary}
              serviceName={serviceLabel(diary, selectedBooking)}
              history={historyView(diary, selectedBooking)}
              owner={diary.staff.role === "owner"}
              busy={busy}
              act={act}
              today={today}
              onClose={() => setSelected(null)}
              onRebook={(b) => {
                setSelected(null);
                onRebook?.(b);
              }}
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

/** "22" or "22.50" typed at checkout, as pence. Null when it is not a price. */
function parsePounds(text: string) {
  const n = Number(text.replace(/[£,\s]/g, ""));
  return text.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 1000
    ? Math.round(n * 100)
    : null;
}

export function BookingSheet({
  booking,
  serviceName,
  history,
  owner,
  busy,
  act,
  today,
  diary,
  onClose,
  onRebook,
}: {
  booking: Booking;
  serviceName: string;
  history?: HistoryView;
  owner: boolean;
  busy: boolean;
  act: Act;
  today: string;
  diary?: Diary;
  onClose: () => void;
  onRebook?: (booking: Booking) => void;
}) {
  const customer = customerOf(booking);
  const isOpen = OPEN_STATUSES.includes(booking.status);
  const started =
    booking.local_date < today ||
    (booking.local_date === today && booking.start_minute <= shopMinute());
  const [checkout, setCheckout] = useState(false);
  // What was actually done and charged: the booking to start with, editable at checkout.
  const chairPrices = (diary?.prices ?? []).filter(
    (p) => p.barber_id === booking.barber_id && p.active !== false,
  );
  const serviceOptions = [...(diary?.services ?? [])]
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .filter(
      (s) =>
        s.id === booking.service_id ||
        chairPrices.some((p) => p.service_id === s.id),
    );
  const [serviceId, setServiceId] = useState(booking.service_id);
  const [priceText, setPriceText] = useState(() => pounds(booking.price_pence));
  const pricePence = parsePounds(priceText);
  const setStatus = (status: Booking["status"], paid_by?: PaidBy) =>
    act("/api/staff/diary", {
      action: "status",
      id: booking.id,
      status,
      version: booking.updated_at,
      ...(paid_by ? { paid_by } : {}),
      ...(status === "done" && serviceId !== booking.service_id
        ? { service: serviceId }
        : {}),
      ...(status === "done" &&
      pricePence !== null &&
      pricePence !== booking.price_pence
        ? { price_pence: pricePence }
        : {}),
    });
  const feeOpen = owner && ["review", "charging"].includes(booking.fee_status);
  return (
    <aside
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Appointment"
    >
      <button
        type="button"
        className="sheet-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <div className="sheet-head">
        <span className="avatar is-large">{initials(customer.name)}</span>
        <div>
          <h2>{customer.name}</h2>
          <p className="sheet-kicker">
            {shortDay(booking.local_date)} ·{" "}
            {timeRange(booking.start_minute, booking.duration)} ·{" "}
            {booking.barbers?.name ?? "chair"}
          </p>
        </div>
      </div>
      <p className="sheet-status">
        <span className={`status-chip status-${booking.status}`}>
          {STATUS_LABEL[booking.status]}
          {booking.status === "done" && booking.paid_by
            ? ` · ${PAID_LABEL[booking.paid_by]}`
            : ""}
        </span>
        {booking.late_minutes > 0 && (
          <span className="status-chip">
            Running {booking.late_minutes} min late
          </span>
        )}
        {booking.source === "walk_in" && (
          <span className="status-chip is-quiet">Walk-in</span>
        )}
        {booking.squeezed && (
          <span className="status-chip is-quiet">Squeezed in</span>
        )}
      </p>
      <div className="sheet-service">
        <span>
          {serviceName}
          <small>
            {booking.duration} min with {booking.barbers?.name ?? "chair"}
          </small>
        </span>
        <strong>{pounds(booking.price_pence)}</strong>
      </div>
      {history && (
        <p className="sheet-history">
          {history.visits === 0
            ? "First visit."
            : `${history.visits} previous visit${history.visits === 1 ? "" : "s"}.`}
          {history.last ? ` Last time: ${history.last}.` : ""}
          {history.noShows > 0 && (
            <span className="no-shows">
              {" "}
              {history.noShows} no show{history.noShows === 1 ? "" : "s"}.
            </span>
          )}
        </p>
      )}
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
      {!isOpen && onRebook && (
        <div className="sheet-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => onRebook(booking)}
          >
            {booking.status === "done" ? "Book again" : "Rebook"}
          </button>
        </div>
      )}
      {isOpen && !checkout && (
        <>
          <div className="sheet-actions">
            {booking.status === "booked" && (
              <button
                type="button"
                className={started ? "button-secondary" : "button-primary"}
                disabled={busy}
                onClick={() => void setStatus("arrived")}
              >
                In the chair
              </button>
            )}
            <button
              type="button"
              className={started ? "button-primary" : "button-secondary"}
              disabled={busy || !started}
              title={
                started ? undefined : "Available once the trim has started"
              }
              onClick={() => setCheckout(true)}
            >
              Checkout
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
          <MoveForm booking={booking} busy={busy} act={act} />
        </>
      )}
      {isOpen && checkout && (
        <div className="checkout-box">
          {serviceOptions.length > 0 && (
            <div className="checkout-fields">
              <label>
                What was done
                <select
                  value={serviceId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setServiceId(next);
                    const chair = chairPrices.find(
                      (p) => p.service_id === next,
                    );
                    if (chair) setPriceText(pounds(chair.price_pence));
                  }}
                >
                  {serviceOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {canonicalServiceName(s.slug, s.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Price (pounds)
                <input
                  inputMode="decimal"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  aria-invalid={pricePence === null}
                />
              </label>
            </div>
          )}
          <p className="checkout-total">
            <span>Total</span>
            <strong>
              {pricePence === null ? "?" : pounds(pricePence)} pounds
            </strong>
          </p>
          {(serviceId !== booking.service_id ||
            (pricePence !== null && pricePence !== booking.price_pence)) && (
            <p className="staff-muted checkout-note">
              Booked as {serviceName} at {pounds(booking.price_pence)} pounds.
              Sales and pay use what you record here.
            </p>
          )}
          <p className="staff-muted">How did {customer.name} pay?</p>
          <div className="checkout-methods">
            {(["card", "cash", "other"] as PaidBy[]).map((method) => (
              <button
                key={method}
                type="button"
                className="button-secondary"
                disabled={busy || pricePence === null}
                onClick={() => void setStatus("done", method)}
              >
                {PAID_LABEL[method]}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy || pricePence === null}
              onClick={() => void setStatus("done")}
            >
              Done without recording payment
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setCheckout(false)}
            >
              Back
            </button>
          </div>
        </div>
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
        Booked for {inputTime(booking.start_minute)} on {booking.local_date}.
        Hold the card in the calendar to drag it to another time or chair.
      </p>
    </aside>
  );
}

type FreeTimes = { date: string; free: number[]; closed: boolean; at: string };

/**
 * Move a trim to a free time on the same chair. The free times come from the
 * live diary for that day and refresh every half minute while the form is open,
 * so two people cannot be offered the same gap. The database refuses an overlap
 * regardless.
 */
function MoveForm({
  booking,
  busy,
  act,
}: {
  booking: Booking;
  busy: boolean;
  act: Act;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(booking.local_date);
  const [time, setTime] = useState(booking.start_minute);
  const [result, setResult] = useState<FreeTimes | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    const check = async () => {
      try {
        const day = (await api("/api/staff/diary?date=" + date)) as Diary;
        if (!live) return;
        const { free, closed } = freeTimes(
          day,
          date,
          booking.barber_id,
          booking.duration,
          booking.id,
        );
        setResult({ date, free, closed, at: clock(shopMinute()) });
      } catch {
        if (live)
          setResult({ date, free: [], closed: false, at: clock(shopMinute()) });
      }
    };
    void check();
    const timer = setInterval(check, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [open, date, booking.id, booking.barber_id, booking.duration]);
  const current = result && result.date === date ? result : null;
  const value = current
    ? current.free.includes(time)
      ? time
      : current.free[0]
    : undefined;
  const chair = booking.barbers?.name ?? "this chair";
  return (
    <details
      className="sheet-move"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Reschedule</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (value === undefined) return;
          void act("/api/staff/diary", {
            action: "move",
            id: booking.id,
            date,
            time: value,
            version: booking.updated_at,
          });
        }}
      >
        <label>
          New date
          <input
            type="date"
            required
            value={date}
            onChange={(event) =>
              event.target.value && setDate(event.target.value)
            }
          />
        </label>
        <label>
          New time
          <select
            value={value ?? ""}
            disabled={!current || current.free.length === 0}
            onChange={(event) => setTime(Number(event.target.value))}
          >
            {!current && <option value="">Checking the diary…</option>}
            {current && current.free.length === 0 && (
              <option value="">
                {current.closed ? "Closed that day" : "No free times that day"}
              </option>
            )}
            {current?.free.map((minute) => (
              <option key={minute} value={minute}>
                {clock(minute)}
                {date === booking.local_date && minute === booking.start_minute
                  ? " (current time)"
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="move-live" role="status">
          {current
            ? `Free times for ${chair} at ${current.at}, from the live diary. Updates every half minute.`
            : `Checking ${chair}’s diary…`}
        </p>
        <button
          type="submit"
          className="button-secondary"
          disabled={busy || value === undefined}
        >
          Save move
        </button>
      </form>
    </details>
  );
}

export function BlockSheet({
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
        {block.local_date ? ` · ${shortDay(block.local_date)}` : ""}
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
            if (confirm("Remove this blocked time?"))
              void act("/api/staff/diary", { action: "unblock", id: block.id });
          }}
        >
          Remove
        </button>
      </div>
    </aside>
  );
}
