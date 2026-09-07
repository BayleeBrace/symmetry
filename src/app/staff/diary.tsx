"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  staffApi as api,
  StaffSignInRequired,
  resetStaffSession,
} from "@/lib/staff-client";
import { PushButton } from "@/components/push-button";
import { addDays, shopToday } from "@/lib/booking-data";
import {
  type Barber,
  type Diary as DiaryData,
  dayLabel,
  shortDay,
} from "./types";
import { DayTimeline } from "./timeline";
import { BreakForm, WalkInForm, type WalkInPrefill } from "./forms";
import { Reports } from "./reports";
import { Settings } from "./settings";
import { DeliveryAlert, Readiness } from "./readiness";

const TABS = [
  "diary",
  "walk-in",
  "breaks",
  "reports",
  "settings",
  "launch checks",
] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  diary: "Diary",
  "walk-in": "Walk-in",
  breaks: "Breaks",
  reports: "Reports",
  settings: "Settings",
  "launch checks": "Launch checks",
};

export function Diary() {
  const [date, setDate] = useState(shopToday());
  const [diary, setDiary] = useState<DiaryData | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("diary");
  const [walkIn, setWalkIn] = useState<WalkInPrefill>(null);
  const dateInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const next = (await api("/api/staff/diary?date=" + date)) as DiaryData;
      setDiary(next);
      setError("");
    } catch (e) {
      if (e instanceof StaffSignInRequired) {
        setDiary(null);
        setError("");
      } else setError((e as Error).message);
    } finally {
      setChecked(true);
    }
  }, [date]);

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

  async function act(url: string, data: unknown) {
    setBusy(true);
    setError("");
    try {
      await api(url, data);
      await load();
    } catch (e) {
      if (e instanceof StaffSignInRequired) setDiary(null);
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const quietAct = (url: string, data: unknown) =>
    act(url, data).catch(() => undefined);

  if (!checked)
    return (
      <section className="staff-shell">
        <p role="status" className="staff-muted">
          Opening the diary…
        </p>
      </section>
    );

  if (!diary)
    return (
      <section className="staff-shell staff-signin">
        <p className="staff-kicker">Staff</p>
        <h1>Your day.</h1>
        <p className="staff-muted">Sign in to your chair.</p>
        <form
          className="staff-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            setError("");
            try {
              await api("/api/staff/session", {
                email: f.get("email"),
                password: f.get("password"),
              });
              resetStaffSession();
              await load();
            } catch (err) {
              if (err instanceof StaffSignInRequired) setDiary(null);
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="wide">
            Email
            <input required type="email" name="email" autoComplete="username" />
          </label>
          <label className="wide">
            Password
            <input
              required
              type="password"
              name="password"
              autoComplete="current-password"
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={busy}>
              Sign in
            </button>
          </div>
        </form>
        {error && (
          <p role="alert" className="staff-error">
            {error}
          </p>
        )}
      </section>
    );

  const owner = diary.staff.role === "owner";
  const barbers: Barber[] = diary.barbers.filter(
    (b) => b.active !== false && (owner || b.id === diary.staff.barber_id),
  );
  const today = shopToday();
  const tabs = TABS.filter(
    (t) => owner || !["settings", "launch checks"].includes(t),
  );
  const showDate = ["diary", "walk-in", "breaks"].includes(tab);

  return (
    <section className="staff-shell">
      <div className="staff-top">
        <div>
          <p className="staff-kicker">
            {owner ? "Owner" : "Barber"} ·{" "}
            {barbers.map((b) => b.name).join(", ")}
          </p>
          <h1>Your day.</h1>
        </div>
        <div className="staff-who">
          <PushButton />
          <button
            type="button"
            className="text-button"
            onClick={async () => {
              const r = await fetch("/api/staff/session", {
                method: "DELETE",
              });
              resetStaffSession();
              setDiary(null);
              if (!r.ok) setError((await r.json()).error);
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {owner && <DeliveryAlert onReview={() => setTab("launch checks")} />}

      <nav className="staff-nav" aria-label="Staff sections">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              if (t !== "walk-in") setWalkIn(null);
            }}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      {showDate && (
        <div className="day-nav">
          <button
            type="button"
            className="arrow"
            aria-label="Previous day"
            onClick={() => setDate(addDays(date, -1))}
          >
            ‹
          </button>
          <button
            type="button"
            className="day-name"
            onClick={() => {
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
            {date === today ? "Today · " : ""}
            <span className="day-long">{dayLabel(date)}</span>
            <span className="day-short">{shortDay(date)}</span>
          </button>
          <button
            type="button"
            className="arrow"
            aria-label="Next day"
            onClick={() => setDate(addDays(date, 1))}
          >
            ›
          </button>
          <input
            ref={dateInput}
            className="day-picker"
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          {date !== today && (
            <button
              type="button"
              className="text-button"
              onClick={() => setDate(today)}
            >
              Back to today
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}

      {tab === "diary" && (
        <DayTimeline
          diary={diary}
          barbers={barbers}
          date={date}
          busy={busy}
          act={quietAct}
          onWalkIn={(barber, minute) => {
            setWalkIn({ barberId: barber.id, minute });
            setTab("walk-in");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
      {tab === "walk-in" && (
        <WalkInForm
          key={walkIn ? `${walkIn.barberId}-${walkIn.minute}` : "fresh"}
          diary={diary}
          barbers={barbers}
          date={date}
          prefill={walkIn}
          busy={busy}
          act={act}
        />
      )}
      {tab === "breaks" && (
        <BreakForm
          barbers={barbers}
          date={date}
          hours={diary.hours}
          busy={busy}
          act={act}
        />
      )}
      {tab === "reports" && <Reports />}
      {tab === "settings" && owner && (
        <Settings diary={diary} act={act} busy={busy} />
      )}
      {tab === "launch checks" && owner && <Readiness />}
    </section>
  );
}
