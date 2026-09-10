"use client";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { staffApi as api, StaffSignInRequired } from "@/lib/staff-client";
import { addDays, clock, shopMinute, shopToday } from "@/lib/booking-data";
import {
  type Act,
  type Barber,
  type Block,
  type Context,
  type Diary,
  OPEN_STATUSES,
  chairHours,
  dayLabel,
  dayNumber,
  initials,
  serviceTint,
  shortDay,
  timeRange,
  weekDays,
  weekLabel,
  weekStart,
  weekdayShort,
} from "./types";
import {
  BlockSheet,
  BookingSheet,
  DayTimeline,
  OffHours,
  TrimCard,
  historyView,
  serviceLabel,
} from "./timeline";
import { attachDrag, type DragDrop } from "./drag";
import { BlockedTime, NewAppointment } from "./forms";

export type BookPrefill = {
  client?: { name: string; email: string; phone: string };
  barberId?: string;
  date?: string;
  minute?: number;
};

/** "mine" and "all" are remembered on the device; a barber id is a one-off pick. */
export type CalendarState = {
  date: string;
  view: "day" | "week";
  team: "all" | "mine" | string;
};

type Drawer =
  | { kind: "new"; prefill: BookPrefill }
  | { kind: "block"; date: string }
  | null;

export function Calendar({
  ctx,
  act,
  busy,
  state,
  onState,
  prefill,
  onPrefillUsed,
}: {
  ctx: Context;
  act: Act;
  busy: boolean;
  state: CalendarState;
  onState: (next: Partial<CalendarState>) => void;
  prefill: BookPrefill | null;
  onPrefillUsed: () => void;
}) {
  const today = shopToday();
  const chairs = [...ctx.barbers]
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const ownChair = chairs.find((b) => b.id === ctx.staff.barber_id);
  const { date, view } = state;
  const team = state.team;
  const teamId =
    team === "all" ? null : team === "mine" ? (ownChair?.id ?? null) : team;
  const barbers = teamId ? chairs.filter((b) => b.id === teamId) : chairs;
  const weekBarber =
    barbers.length === 1 ? barbers[0] : (ownChair ?? chairs[0]);

  const [data, setData] = useState<Diary | null>(null);
  const [loadError, setLoadError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [stripOpen, setStripOpen] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>(() =>
    prefill ? { kind: "new", prefill } : null,
  );
  const [notice, setNotice] = useState("");
  const dateInput = useRef<HTMLInputElement>(null);

  const from = view === "week" ? weekStart(date) : date;
  const days = view === "week" ? 7 : 1;
  const load = useCallback(async () => {
    try {
      const d = (await api(
        `/api/staff/diary?date=${from}&days=${days}`,
      )) as Diary;
      setData(d);
      setLoadError("");
    } catch (e) {
      if (!(e instanceof StaffSignInRequired))
        setLoadError((e as Error).message);
    }
  }, [from, days]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    const resume = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [load]);

  const run: Act = async (url, payload) => {
    try {
      return await act(url, payload);
    } finally {
      // Always refresh, so a refused move puts the card back where it was.
      await load();
    }
  };
  const quiet: Act = (url, payload) => run(url, payload).catch(() => undefined);

  /** A dropped trim shows in its new place at once, then saves. If the diary refuses, the refresh puts it back. */
  const moveTrim = (drop: DragDrop, by: "chair" | "day") => {
    const chair = chairs.find((c) => c.id === drop.column);
    setData(
      (current) =>
        current && {
          ...current,
          bookings: current.bookings.map((b) =>
            b.id !== drop.id
              ? b
              : {
                  ...b,
                  start_minute: drop.minute,
                  ...(by === "chair"
                    ? {
                        barber_id: drop.column,
                        barbers: {
                          name: chair?.name ?? b.barbers?.name ?? "",
                          slug: chair?.slug ?? b.barbers?.slug ?? "",
                        },
                      }
                    : { local_date: drop.column }),
                },
          ),
        },
    );
    void quiet("/api/staff/diary", {
      action: "move",
      id: drop.id,
      date: by === "day" ? drop.column : date,
      time: drop.minute,
      ...(by === "chair" ? { barber: drop.column } : {}),
      version: drop.version,
    });
  };

  const step = (direction: 1 | -1) =>
    onState({ date: addDays(date, direction * (view === "week" ? 7 : 1)) });
  const openNew = (extra: BookPrefill = {}) => {
    setAddOpen(false);
    setDrawer({
      kind: "new",
      prefill: {
        date,
        barberId: teamId ?? undefined,
        ...extra,
      },
    });
  };
  const closeDrawer = () => {
    setDrawer(null);
    onPrefillUsed();
  };

  const dayData =
    data && view === "day" && data.date === date
      ? data
      : data && view === "week" && data.date === from
        ? data
        : null;

  return (
    <section className="staff-calendar" aria-label="Calendar">
      <div className="cal-bar">
        <div className="cal-nav">
          <button
            type="button"
            className="btn-quiet"
            onClick={() => onState({ date: today })}
          >
            Today
          </button>
          <button
            type="button"
            className="cal-arrow"
            aria-label={view === "week" ? "Previous week" : "Previous day"}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="cal-date"
            aria-expanded={stripOpen}
            onClick={() => {
              // On a phone the date opens the week strip; on desktop, the date picker.
              if (window.matchMedia("(max-width: 760px)").matches) {
                setStripOpen((o) => !o);
                return;
              }
              const input = dateInput.current;
              if (!input) return;
              if ("showPicker" in input) {
                try {
                  (
                    input as HTMLInputElement & { showPicker: () => void }
                  ).showPicker();
                  return;
                } catch {}
              }
              input.focus();
            }}
            aria-label={`Pick a date. Showing ${dayLabel(date)}`}
          >
            {view === "week" ? (
              weekLabel(date)
            ) : (
              <>
                <span className="day-long">
                  {date === today ? "Today · " : ""}
                  {dayLabel(date)}
                </span>
                <span className="day-short">{shortDay(date)}</span>
              </>
            )}
            <span className="cal-caret" aria-hidden="true">
              ▾
            </span>
          </button>
          <button
            type="button"
            className="cal-arrow"
            aria-label={view === "week" ? "Next week" : "Next day"}
            onClick={() => step(1)}
          >
            ›
          </button>
          <input
            ref={dateInput}
            className="day-picker"
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) =>
              e.target.value && onState({ date: e.target.value })
            }
          />
        </div>
        <button
          type="button"
          className="cal-filter-toggle"
          aria-label="Chairs and view"
          aria-expanded={toolsOpen}
          onClick={() => setToolsOpen((o) => !o)}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5" />
          </svg>
        </button>
        {toolsOpen && (
          <div className="menu-backdrop" onClick={() => setToolsOpen(false)} />
        )}
        <div className={`cal-tools ${toolsOpen ? "is-open" : ""}`}>
          {chairs.length > 1 && (
            <label className="cal-select">
              <span className="sr-only">Team</span>
              <select
                value={
                  view === "week"
                    ? (weekBarber?.id ?? "all")
                    : team === "mine"
                      ? (ownChair?.id ?? "all")
                      : team
                }
                onChange={(e) =>
                  onState({
                    team:
                      e.target.value === "all"
                        ? "all"
                        : e.target.value === ownChair?.id
                          ? "mine"
                          : e.target.value,
                  })
                }
              >
                {view === "day" && <option value="all">All chairs</option>}
                {chairs.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.id === ownChair?.id ? " (me)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="cal-seg" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={view === "day"}
              onClick={() => onState({ view: "day" })}
            >
              Day
            </button>
            <button
              type="button"
              aria-pressed={view === "week"}
              onClick={() => onState({ view: "week" })}
            >
              Week
            </button>
          </div>
          <div className="cal-add">
            <button
              type="button"
              className="button-primary"
              aria-expanded={addOpen}
              onClick={() => setAddOpen((o) => !o)}
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {addOpen && (
        <div className="add-menu-host">
          <div className="menu-backdrop" onClick={() => setAddOpen(false)} />
          <div className="menu" role="menu">
            <button type="button" role="menuitem" onClick={() => openNew()}>
              New appointment
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAddOpen(false);
                setDrawer({ kind: "block", date });
              }}
            >
              Blocked time
            </button>
          </div>
        </div>
      )}

      {view === "day" && stripOpen && (
        <div className="date-strip" aria-label="This week">
          {weekDays(date).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === date}
              className={d === today ? "is-today" : ""}
              onClick={() => onState({ date: d })}
            >
              <span>{weekdayShort(d).slice(0, 1)}</span>
              <strong>{dayNumber(d)}</strong>
            </button>
          ))}
        </div>
      )}

      {loadError && (
        <p className="staff-error" role="alert">
          {loadError}
        </p>
      )}
      {notice && (
        <p className="day-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => setNotice("")}
          >
            OK
          </button>
        </p>
      )}

      {!dayData ? (
        <p role="status" className="staff-muted">
          Opening the diary…
        </p>
      ) : view === "day" ? (
        <DayTimeline
          diary={dayData}
          barbers={barbers}
          date={date}
          busy={busy}
          act={quiet}
          onMove={(drop) => moveTrim(drop, "chair")}
          onWalkIn={(barber, minute) =>
            openNew({ barberId: barber.id, minute, date })
          }
        />
      ) : weekBarber ? (
        <WeekGrid
          diary={dayData}
          barber={weekBarber}
          days={weekDays(date)}
          busy={busy}
          act={quiet}
          onMove={(drop) => moveTrim(drop, "day")}
          onGap={(day, minute) =>
            openNew({ barberId: weekBarber.id, date: day, minute })
          }
        />
      ) : null}

      <button
        type="button"
        className="fab"
        aria-label="Add"
        onClick={() => setAddOpen((o) => !o)}
      >
        +
      </button>

      {drawer?.kind === "new" && (
        <>
          <div className="sheet-backdrop" onClick={closeDrawer} />
          <NewAppointment
            ctx={ctx}
            chairs={barbers.length ? barbers : chairs}
            allChairs={chairs}
            cached={data}
            prefill={drawer.prefill}
            busy={busy}
            act={run}
            onClose={closeDrawer}
            onSaved={(message) => {
              closeDrawer();
              setNotice(message);
            }}
          />
        </>
      )}
      {drawer?.kind === "block" && (
        <>
          <div className="sheet-backdrop" onClick={closeDrawer} />
          <BlockedTime
            chairs={barbers.length ? barbers : chairs}
            cached={data}
            date={drawer.date}
            busy={busy}
            act={run}
            onClose={closeDrawer}
            onSaved={(message) => {
              closeDrawer();
              setNotice(message);
            }}
          />
        </>
      )}
    </section>
  );
}

type Selection = { kind: "booking" | "block"; id: string } | null;

/** One chair across seven days. */
function WeekGrid({
  diary,
  barber,
  days,
  busy,
  act,
  onMove,
  onGap,
}: {
  diary: Diary;
  barber: Barber;
  days: string[];
  busy: boolean;
  act: Act;
  onMove: (drop: DragDrop) => void;
  onGap: (date: string, minute: number) => void;
}) {
  const [selected, setSelected] = useState<Selection>(null);
  const [nowMinute, setNowMinute] = useState(() => shopMinute());
  useEffect(() => {
    const timer = setInterval(() => setNowMinute(shopMinute()), 60000);
    return () => clearInterval(timer);
  }, []);
  const today = shopToday();
  const mine = <T extends { barber_id: string }>(x: T) =>
    x.barber_id === barber.id;
  const bookings = diary.bookings.filter(mine);
  const blocks = diary.blocks.filter(mine);
  const hours = days
    .map((d) => chairHours(diary, d, barber.id))
    .filter((h): h is [number, number] => Boolean(h));
  const starts = [
    ...hours.map((h) => h[0]),
    ...bookings.map((b) => b.start_minute),
    ...blocks.filter((b) => b.duration < 1440).map((b) => b.start_minute),
  ];
  const ends = [
    ...hours.map((h) => h[1]),
    ...bookings.map((b) => b.start_minute + b.duration),
    ...blocks
      .filter((b) => b.duration < 1440)
      .map((b) => b.start_minute + b.duration),
  ];
  const start = starts.length
    ? Math.max(0, Math.floor(Math.min(...starts) / 60) * 60)
    : 540;
  const end = ends.length
    ? Math.min(1440, Math.ceil(Math.max(...ends) / 60) * 60)
    : 1080;
  const rows = Math.max(4, (end - start) / 15);
  const top = (minute: number) => `calc(${(minute - start) / 15} * var(--row))`;
  const height = (duration: number) =>
    `calc(${duration / 15} * var(--row) - 2px)`;
  const hourMarks: number[] = [];
  for (let h = start; h <= end; h += 60) hourMarks.push(h);
  const selectedBooking =
    selected?.kind === "booking"
      ? bookings.find((b) => b.id === selected.id)
      : undefined;
  const selectedBlock =
    selected?.kind === "block"
      ? blocks.find((b) => b.id === selected.id)
      : undefined;
  // Drag a trim to another day or time on this chair. Handlers live in refs so a refresh mid-drag does not tear it down.
  const gridRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<(drop: DragDrop) => void>(() => {});
  const busyRef = useRef(busy);
  useEffect(() => {
    dropRef.current = onMove;
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
      canDrag: (card) => card.dataset.open === "1" && !busyRef.current,
      onDrop: (drop) => dropRef.current(drop),
    });
  }, [start, end, rows]);
  return (
    <div className="week" style={{ "--rows": rows } as CSSProperties}>
      <p className="week-who">
        <span className="avatar">{initials(barber.name)}</span>
        {barber.name}
        <small>
          {bookings.filter((b) => OPEN_STATUSES.includes(b.status)).length}{" "}
          trims this week
        </small>
      </p>
      <div className="week-grid" ref={gridRef}>
        <div className="hour-rail" aria-hidden="true">
          {hourMarks.map((h) => (
            <span key={h} style={{ top: top(h) }}>
              {clock(h)}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const dayHours = chairHours(diary, day, barber.id);
          const dayBookings = bookings.filter((b) => b.local_date === day);
          const dayBlocks = blocks.filter((b) => b.local_date === day);
          const dayOff = dayBlocks.find((b) => b.duration >= 1440);
          const closed = !dayHours || Boolean(dayOff);
          return (
            <section
              key={day}
              className={`week-col ${day === today ? "is-today" : ""} ${closed ? "is-closed" : ""}`}
              aria-label={`${dayLabel(day)}: ${dayBookings.length} trims`}
            >
              <header className="week-head">
                <span>{weekdayShort(day)}</span>
                <strong>{dayNumber(day)}</strong>
              </header>
              <div
                className="chair-day"
                data-key={day}
                onClick={(event) => {
                  if (event.target !== event.currentTarget || closed) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const rowPx = rect.height / rows;
                  const minute =
                    start +
                    Math.max(
                      0,
                      Math.floor((event.clientY - rect.top) / rowPx),
                    ) *
                      15;
                  onGap(day, Math.min(minute, end - 15));
                }}
                title={
                  closed
                    ? undefined
                    : "Tap a gap to add an appointment. Hold a trim to move it."
                }
              >
                {!dayOff && dayHours && (
                  <OffHours
                    hours={dayHours}
                    start={start}
                    end={end}
                    top={top}
                    height={height}
                  />
                )}
                {day === today && nowMinute >= start && nowMinute <= end && (
                  <div className="now-line" style={{ top: top(nowMinute) }} />
                )}
                {dayOff ? (
                  <button
                    type="button"
                    className="chair-off"
                    onClick={() =>
                      setSelected({ kind: "block", id: dayOff.id })
                    }
                  >
                    {dayOff.label}
                  </button>
                ) : (
                  !dayHours && <div className="chair-off is-static">Closed</div>
                )}
                {dayBlocks
                  .filter((b) => b.duration < 1440)
                  .map((block: Block) => (
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
                {dayBookings.map((booking) => (
                  <TrimCard
                    key={booking.id}
                    booking={booking}
                    service={serviceLabel(diary, booking)}
                    tint={serviceTint(diary, booking.service_id)}
                    selected={selected?.id === booking.id}
                    top={top(booking.start_minute)}
                    height={height(booking.duration)}
                    onClick={() =>
                      setSelected({ kind: "booking", id: booking.id })
                    }
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {(selectedBooking || selectedBlock) && (
        <>
          <div className="sheet-backdrop" onClick={() => setSelected(null)} />
          {selectedBooking && (
            <BookingSheet
              booking={selectedBooking}
              serviceName={serviceLabel(diary, selectedBooking)}
              history={historyView(diary, selectedBooking)}
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
              barber={barber}
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
