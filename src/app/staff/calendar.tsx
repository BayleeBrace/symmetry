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
  type Booking,
  type Context,
  type Diary,
  OPEN_STATUSES,
  WALK_IN,
  chairHours,
  customerOf,
  dayLabel,
  dayNumber,
  freeTimes,
  initials,
  laneLayout,
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
  type Placement,
  TrimCard,
  historyView,
  serviceLabel,
} from "./timeline";
import { attachDrag, type DragDrop } from "./drag";
import { showsInDiary } from "@/lib/diary-visibility";
import { soonestStart, squeezeStart } from "@/lib/squeeze";
import {
  type BlockPrefill,
  BlockedTime,
  NewAppointment,
  WaitlistForm,
} from "./forms";
import { toast } from "./toast";
import { Loading } from "./spinner";
import { useDialog } from "./dialog";

export type BookPrefill = {
  /** id is the client's record, when they were picked from the client list. */
  client?: { id?: string; name: string; email: string; phone: string };
  barberId?: string;
  serviceId?: string;
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
  | { kind: "block"; prefill: BlockPrefill }
  | { kind: "waitlist"; date: string }
  | null;

/** How long the "select time" placeholder is drawn before a service is chosen. */
const PLACE_MINUTES = 30;

const Chevron = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);

export function Calendar({
  ctx,
  act,
  busy,
  state,
  onState,
  prefill,
  onPrefillUsed,
  addOpen,
  onAddOpen,
  onSignedOut,
}: {
  ctx: Context;
  act: Act;
  busy: boolean;
  state: CalendarState;
  onState: (next: Partial<CalendarState>) => void;
  prefill: BookPrefill | null;
  onPrefillUsed: () => void;
  addOpen: boolean;
  onAddOpen: (open: boolean) => void;
  /** The sign-in ran out while the diary refreshed by itself. */
  onSignedOut: () => void;
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
  const setAddOpen = onAddOpen;
  const [stripOpen, setStripOpen] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>(() =>
    prefill ? { kind: "new", prefill } : null,
  );
  // "Select time": a plus placeholder on the day that can be dragged, or moved by tapping a gap.
  const [placing, setPlacing] = useState<Placement | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);

  const from = view === "week" ? weekStart(date) : date;
  const days = view === "week" ? 7 : 1;
  const to = addDays(from, days - 1);
  // Only the newest request may fill the diary: a slow answer for a day no longer shown is dropped.
  const latest = useRef(0);
  const signedOut = useRef(onSignedOut);
  const load = useCallback(async () => {
    const request = ++latest.current;
    try {
      const d = (await api(
        `/api/staff/diary?date=${from}&days=${days}`,
      )) as Diary;
      if (request !== latest.current) return;
      setData(d);
      setLoadError("");
    } catch (e) {
      if (request !== latest.current) return;
      if (e instanceof StaffSignInRequired) signedOut.current();
      else setLoadError((e as Error).message);
    }
  }, [from, days]);
  // An action finishing after the day changed refreshes the day now shown, not the one it started on.
  const loadNow = useRef(load);
  useEffect(() => {
    signedOut.current = onSignedOut;
    loadNow.current = load;
  });
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
      await loadNow.current();
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

  // Any change of day, view or chair ends a "select time" in progress.
  const go = (next: Partial<CalendarState>) => {
    setPlacing(null);
    onState(next);
  };
  const step = (direction: 1 | -1) =>
    go({ date: addDays(date, direction * (view === "week" ? 7 : 1)) });
  const openNew = (extra: BookPrefill = {}) => {
    setAddOpen(false);
    setPlacing(null);
    setDrawer({
      kind: "new",
      prefill: {
        date,
        barberId: teamId ?? undefined,
        ...extra,
      },
    });
  };
  const openBlock = (extra: Partial<BlockPrefill> = {}) => {
    setAddOpen(false);
    setPlacing(null);
    setDrawer({
      kind: "block",
      prefill: { date, barberId: teamId ?? undefined, ...extra },
    });
  };
  /** A cancelled, no-show or finished trim booked again: same client, chair and trim, from that slot. */
  const rebook = (b: Booking) => {
    const c = customerOf(b);
    openNew({
      client: {
        id: b.booking_groups?.customer_id,
        name: c.name,
        email: c.email ?? "",
        phone: c.phone ?? "",
      },
      barberId: b.barber_id,
      serviceId: b.service_id,
      date: b.local_date,
      minute: b.start_minute,
    });
  };
  const closeDrawer = () => {
    setDrawer(null);
    setPlacing(null);
    onPrefillUsed();
  };

  // The diary on screen must be the one asked for: the same first day, and for a week all seven.
  const dayData =
    data &&
    data.date === from &&
    (view === "day" || (data.to ?? data.date) === to)
      ? data
      : null;
  const waitingToday = view === "day" ? (dayData?.waiting?.[date] ?? 0) : 0;
  // The highlighted chip: the week's chair, or the day's single chair ("All" covers the rest).
  const chipChair = view === "week" ? weekBarber?.id : teamId;

  /** The next quarter hour a chair is free from now (or from opening on another day). */
  /** How long the chair's first service takes: the one a new appointment starts with. */
  const firstServiceMinutes = (barberId: string) => {
    const offered = ctx.prices.filter(
      (p) => p.barber_id === barberId && p.active !== false,
    );
    const first = ctx.services.find((s) =>
      offered.some((p) => p.service_id === s.id),
    );
    return (
      offered.find((p) => p.service_id === first?.id)?.duration ?? PLACE_MINUTES
    );
  };
  const nextFree = (barberId: string) => {
    if (!dayData) return null;
    const hours = chairHours(dayData, date, barberId);
    if (!hours) return null;
    const earliest =
      date === today ? Math.ceil(shopMinute() / 15) * 15 : hours[0];
    // Long enough for the service the form will start with, so it is not offered a gap that runs past closing.
    const minutes = firstServiceMinutes(barberId);
    const free = freeTimes(dayData, date, barberId, minutes).free;
    return (
      free.find((m) => m >= earliest) ??
      Math.max(hours[0], Math.min(earliest, hours[1] - minutes))
    );
  };
  /**
   * A walk-in starts now, in the next five minutes, even over a trim that's
   * already there: the form then offers it as a squeeze-in, or the next free
   * time if it can wait. Before opening, or another day, the next free time.
   */
  const walkInStart = (barberId: string) => {
    if (!dayData || date !== today) return nextFree(barberId);
    const hours = chairHours(dayData, date, barberId);
    const now = soonestStart(shopMinute());
    return hours &&
      now >= hours[0] &&
      now + firstServiceMinutes(barberId) <= hours[1]
      ? now
      : nextFree(barberId);
  };
  /** Fresha's "select time": drop a plus on the day, drag it about, then fill in the trim. */
  const startPlacing = () => {
    setAddOpen(false);
    const chair =
      barbers.find((b) => b.id === (teamId ?? ownChair?.id)) ?? barbers[0];
    const minute = chair ? nextFree(chair.id) : null;
    if (view !== "day" || !chair || minute === null) {
      openNew();
      return;
    }
    setPlacing({ barberId: chair.id, minute });
  };
  const finishPlacing = () => {
    if (!placing) return;
    openNew({ barberId: placing.barberId, minute: placing.minute, date });
  };
  const placingChair = placing
    ? chairs.find((c) => c.id === placing.barberId)
    : undefined;

  useEffect(() => {
    if (!placing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlacing(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing]);

  const addMenu = useDialog<HTMLDivElement>(() => setAddOpen(false), addOpen);

  /** The phone's own date picker, from the hidden date field. False when the browser has none to open. */
  const openPicker = () => {
    const input = dateInput.current;
    if (!input) return false;
    if ("showPicker" in input) {
      try {
        (input as HTMLInputElement & { showPicker: () => void }).showPicker();
        return true;
      } catch {}
    }
    return false;
  };

  return (
    <section className="staff-calendar" aria-label="Calendar">
      <div className="cal-bar">
        <div className="cal-nav">
          <button
            type="button"
            className="btn-quiet cal-today"
            onClick={() => go({ date: today })}
          >
            Today
          </button>
          <button
            type="button"
            className="cal-arrow"
            aria-label={view === "week" ? "Previous week" : "Previous day"}
            onClick={() => step(-1)}
          >
            <Chevron d="M15 5l-7 7 7 7" />
          </button>
          <button
            type="button"
            className="cal-date"
            aria-expanded={stripOpen}
            onClick={() => {
              // On a phone the day view's date opens the week strip, which has its own date picker.
              const phone = window.matchMedia("(max-width: 760px)").matches;
              if (phone && view === "day") {
                setStripOpen((o) => !o);
                return;
              }
              if (openPicker()) return;
              // No picker to open from here: a phone gets the strip's date field to tap instead.
              if (phone) setStripOpen((o) => !o);
              else dateInput.current?.focus();
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
              <Chevron d="M6 9l6 6 6-6" size={14} />
            </span>
          </button>
          <button
            type="button"
            className="cal-arrow"
            aria-label={view === "week" ? "Next week" : "Next day"}
            onClick={() => step(1)}
          >
            <Chevron d="M9 5l7 7-7 7" />
          </button>
          <input
            ref={dateInput}
            className="day-picker"
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) => e.target.value && go({ date: e.target.value })}
          />
        </div>
        <div className="cal-seg" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={view === "day"}
            onClick={() => go({ view: "day" })}
          >
            Day
          </button>
          <button
            type="button"
            aria-pressed={view === "week"}
            onClick={() => go({ view: "week" })}
          >
            Week
          </button>
        </div>
        <div className="cal-add">
          <button
            type="button"
            className="button-primary"
            aria-expanded={addOpen}
            onClick={() => setAddOpen(!addOpen)}
          >
            Add
          </button>
        </div>
      </div>

      {(chairs.length > 1 || waitingToday > 0) && (
        <div className="cal-chips">
          {chairs.length > 1 && (
            <div className="chair-chips" role="group" aria-label="Chairs">
              {chairs.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={chipChair === b.id}
                  onClick={() =>
                    go({ team: b.id === ownChair?.id ? "mine" : b.id })
                  }
                >
                  {b.name}
                </button>
              ))}
              {view === "day" && (
                <button
                  type="button"
                  aria-pressed={team === "all"}
                  onClick={() => go({ team: "all" })}
                >
                  All
                </button>
              )}
            </div>
          )}
          {waitingToday > 0 && (
            <button
              type="button"
              className="waiting-link"
              aria-label={`${waitingToday} ${waitingToday === 1 ? "person is" : "people are"} waiting for this day`}
              onClick={() => {
                setPlacing(null);
                setDrawer({ kind: "waitlist", date });
              }}
            >
              {waitingToday} waiting
            </button>
          )}
        </div>
      )}

      {addOpen && (
        <div className="add-menu-host">
          <div className="menu-backdrop" onClick={() => setAddOpen(false)} />
          <div className="menu" role="menu" ref={addMenu}>
            <button type="button" role="menuitem" onClick={startPlacing}>
              New appointment
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                const chair =
                  barbers.find((b) => b.id === (teamId ?? ownChair?.id)) ??
                  barbers[0];
                openNew({
                  client: { name: WALK_IN, email: "", phone: "" },
                  barberId: chair?.id,
                  minute: (chair && walkInStart(chair.id)) ?? undefined,
                });
              }}
            >
              Walk-in now
            </button>
            <button type="button" role="menuitem" onClick={() => openBlock()}>
              Blocked time
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAddOpen(false);
                setPlacing(null);
                setDrawer({ kind: "waitlist", date });
              }}
            >
              Waitlist
            </button>
          </div>
        </div>
      )}

      {placing && (
        <div className="place-bar" role="status">
          <span className="place-bar-text">
            Select time
            <small>
              {placingChair?.name ?? "Chair"} at {clock(placing.minute)}. Drag
              the plus or tap a gap, then tap it to carry on.
            </small>
          </span>
          <button type="button" className="place-next" onClick={finishPlacing}>
            Next
          </button>
          <button
            type="button"
            className="place-cancel"
            aria-label="Stop selecting a time"
            onClick={() => setPlacing(null)}
          >
            ×
          </button>
        </div>
      )}

      {stripOpen && (
        <div className="date-jump">
          {view === "day" && (
            <div className="date-strip" role="group" aria-label="This week">
              {weekDays(date).map((d) => {
                const waiting = data?.waiting?.[d] ?? 0;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={d === date}
                    aria-label={`${dayLabel(d)}${d === today ? ", today" : ""}${waiting ? `, ${waiting} waiting` : ""}`}
                    className={d === today ? "is-today" : ""}
                    onClick={() => go({ date: d })}
                  >
                    <span aria-hidden="true">
                      {weekdayShort(d).slice(0, 1)}
                    </span>
                    <strong aria-hidden="true">{dayNumber(d)}</strong>
                    {waiting > 0 && (
                      <em className="strip-waiting" aria-hidden="true">
                        {waiting}
                      </em>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="strip-foot">
            {date !== today && (
              <button
                type="button"
                className="strip-today"
                onClick={() => go({ date: today })}
              >
                Today
              </button>
            )}
            {/* A real date field under the words, so a tap opens the phone's own picker. */}
            <label className="strip-pick">
              <span aria-hidden="true">Pick another date</span>
              <input
                type="date"
                aria-label="Pick another date"
                value={date}
                onChange={(e) => e.target.value && go({ date: e.target.value })}
              />
            </label>
          </div>
        </div>
      )}

      {loadError && (
        <p className="staff-error" role="alert">
          {loadError}
        </p>
      )}

      {!dayData ? (
        <Loading>Opening the diary…</Loading>
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
          onRebook={rebook}
          placement={placing}
          onPlace={(barberId, minute) => setPlacing({ barberId, minute })}
          onPlaceDone={finishPlacing}
        />
      ) : weekBarber ? (
        <WeekGrid
          diary={dayData}
          barber={weekBarber}
          days={weekDays(date)}
          busy={busy}
          act={quiet}
          onMove={(drop) => moveTrim(drop, "day")}
          onRebook={rebook}
          onGap={(day, minute) =>
            openNew({ barberId: weekBarber.id, date: day, minute })
          }
        />
      ) : null}

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
              toast(message);
            }}
          />
        </>
      )}
      {drawer?.kind === "waitlist" && (
        <>
          <div className="sheet-backdrop" onClick={closeDrawer} />
          <WaitlistForm
            ctx={ctx}
            chairs={chairs}
            date={drawer.date}
            busy={busy}
            act={run}
            onClose={closeDrawer}
            onSaved={(message) => toast(message)}
          />
        </>
      )}
      {drawer?.kind === "block" && (
        <>
          <div className="sheet-backdrop" onClick={closeDrawer} />
          <BlockedTime
            chairs={barbers.length ? barbers : chairs}
            cached={data}
            prefill={drawer.prefill}
            busy={busy}
            act={run}
            onClose={closeDrawer}
            onSaved={(message) => {
              closeDrawer();
              toast(message);
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
  onRebook,
}: {
  diary: Diary;
  barber: Barber;
  days: string[];
  busy: boolean;
  act: Act;
  onMove: (drop: DragDrop) => void;
  onGap: (date: string, minute: number) => void;
  onRebook?: (booking: Booking) => void;
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
  const bookings = diary.bookings.filter((b) => mine(b) && showsInDiary(b));
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
          const lanes = laneLayout(dayBookings);
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
                    lane={lanes.get(booking.id)}
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
              onSqueeze={(b) => {
                setSelected(null);
                onGap(b.local_date, squeezeStart(b, today, shopMinute()));
              }}
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
