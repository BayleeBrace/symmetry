"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { hourWord, inputTime } from "@/lib/booking-data";
import {
  type Act,
  type Barber,
  type Context,
  WEEKDAYS,
  initials,
} from "./types";

type Row = {
  barber: {
    id: string;
    name: string;
    slug: string;
    role_label: string;
    active: boolean;
  };
  account: {
    user_id: string;
    role: "owner" | "barber";
    active: boolean;
    email: string;
    last_sign_in: string | null;
  } | null;
};
type Schedule = {
  barber_id: string;
  iso_weekday: number;
  open_minute: number | null;
  close_minute: number | null;
};

const minuteOf = (value: FormDataEntryValue | null) => {
  if (!value) return null;
  const [h, m] = String(value).split(":").map(Number);
  return h * 60 + m;
};

export function Team({
  ctx,
  act,
  busy,
}: {
  ctx: Context;
  act: Act;
  busy: boolean;
}) {
  const [tab, setTab] = useState<"members" | "shifts">("members");
  return (
    <section className="team" aria-label="Team">
      <header className="sec-head">
        <h1>Team</h1>
        <div className="seg" role="group" aria-label="Team pages">
          <button
            type="button"
            aria-pressed={tab === "members"}
            onClick={() => setTab("members")}
          >
            Team members
          </button>
          <button
            type="button"
            aria-pressed={tab === "shifts"}
            onClick={() => setTab("shifts")}
          >
            Shifts
          </button>
        </div>
      </header>
      {tab === "members" ? (
        <Members />
      ) : (
        <Shifts ctx={ctx} act={act} busy={busy} />
      )}
    </section>
  );
}

function Members() {
  const [team, setTeam] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const load = useCallback(() => {
    api("/api/staff/team")
      .then((d) => {
        setTeam(d.team);
        setError("");
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  async function act(data: unknown, done: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/staff/team", data);
      setCreating(null);
      setResetting(null);
      setNotice(done);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!team)
    return (
      <p role="status" className="staff-muted">
        {error || "Loading the team…"}
      </p>
    );
  return (
    <div className="members">
      <p className="staff-muted">
        The owner’s sign-in sees every chair. A barber’s sign-in shows only
        their own diary, sales and figures. One sign-in per chair.
      </p>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="staff-muted" role="status">
          {notice}
        </p>
      )}
      <div className="team-list">
        {team.map(({ barber, account }) => (
          <article className="team-row" key={barber.id}>
            <span className="avatar">{initials(barber.name)}</span>
            <div className="team-name">
              <strong>{barber.name}</strong>
              <span>{barber.role_label}</span>
            </div>
            <div className="team-account">
              {account ? (
                <>
                  <span>{account.email}</span>
                  <small>
                    {account.role === "owner"
                      ? "Owner, sees everything"
                      : account.active
                        ? "Active"
                        : "Switched off"}
                    {account.last_sign_in
                      ? ` · last signed in ${new Date(account.last_sign_in).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}`
                      : " · never signed in"}
                  </small>
                </>
              ) : (
                <span className="staff-muted">No sign-in yet</span>
              )}
            </div>
            <div className="team-actions">
              {!account && (
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy}
                  onClick={() => {
                    setResetting(null);
                    setCreating(barber.id);
                  }}
                >
                  Create sign-in
                </button>
              )}
              {account && account.role !== "owner" && (
                <>
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        {
                          action: "active",
                          user_id: account.user_id,
                          active: !account.active,
                        },
                        account.active
                          ? `${barber.name}’s sign-in is switched off.`
                          : `${barber.name}’s sign-in is back on.`,
                      )
                    }
                  >
                    {account.active ? "Switch off" : "Switch on"}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setCreating(null);
                      setResetting(account.user_id);
                    }}
                  >
                    Reset password
                  </button>
                </>
              )}
              {account?.role === "owner" && (
                <span className="staff-muted">You</span>
              )}
            </div>
            {creating === barber.id && (
              <form
                className="staff-form inline-editor team-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void act(
                    {
                      action: "create",
                      barber_id: barber.id,
                      email: form.get("email"),
                      password: form.get("password"),
                    },
                    `${barber.name} can now sign in. Tell them the email and temporary password; they can change it in Settings.`,
                  );
                }}
              >
                <p className="wide editor-title">A sign-in for {barber.name}</p>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                  />
                </label>
                <label>
                  Temporary password (at least 8 characters)
                  <input
                    name="password"
                    type="text"
                    required
                    minLength={8}
                    autoComplete="off"
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="button-primary"
                    disabled={busy}
                  >
                    Create sign-in
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setCreating(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {account && resetting === account.user_id && (
              <form
                className="staff-form inline-editor team-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void act(
                    {
                      action: "password",
                      user_id: account.user_id,
                      password: form.get("password"),
                    },
                    `${barber.name}’s password is reset. Tell them the new one.`,
                  );
                }}
              >
                <p className="wide editor-title">
                  New password for {barber.name}
                </p>
                <label className="wide">
                  New password (at least 8 characters)
                  <input
                    name="password"
                    type="text"
                    required
                    minLength={8}
                    autoComplete="off"
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="button-primary"
                    disabled={busy}
                  >
                    Reset password
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setResetting(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Shifts({ ctx, act, busy }: { ctx: Context; act: Act; busy: boolean }) {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<{ barber: Barber; day: number } | null>(
    null,
  );
  const reload = useCallback(() => {
    api("/api/staff/settings")
      .then((d) => {
        setSchedules(d.schedules);
        setError("");
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);
  if (!schedules)
    return (
      <p role="status" className="staff-muted">
        {error || "Loading shifts…"}
      </p>
    );
  const barbers = [...ctx.barbers]
    .filter((b) => b.active !== false)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  const scheduleFor = (barber: Barber, day: number) =>
    schedules.find((s) => s.barber_id === barber.id && s.iso_weekday === day);
  const editing = edit ? scheduleFor(edit.barber, edit.day) : undefined;
  return (
    <div className="shifts">
      <p className="staff-muted">
        Each chair’s usual week. A chair without its own hours follows the shop
        hours. Use blocked time in the calendar for holidays and one-off
        changes; shifts cannot change while future bookings exist for that
        chair.
      </p>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      <div className="grid-wrap">
        <table className="grid-table shifts-table">
          <thead>
            <tr>
              <th scope="col">Chair</th>
              {WEEKDAYS.map((day) => (
                <th scope="col" key={day}>
                  {day.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {barbers.map((barber) => (
              <tr key={barber.id}>
                <th scope="row">
                  <span className="avatar">{initials(barber.name)}</span>
                  {barber.name}
                </th>
                {WEEKDAYS.map((day, index) => {
                  const schedule = scheduleFor(barber, index + 1);
                  const on =
                    edit?.barber.id === barber.id && edit?.day === index + 1;
                  const off =
                    schedule &&
                    (schedule.open_minute === null ||
                      schedule.close_minute === null);
                  return (
                    <td key={day}>
                      <button
                        type="button"
                        className={`${on ? "is-editing" : ""} ${off ? "is-off" : ""}`}
                        onClick={() => setEdit({ barber, day: index + 1 })}
                      >
                        {!schedule
                          ? "Shop hours"
                          : off
                            ? "Off"
                            : `${hourWord(schedule.open_minute!)} to ${hourWord(schedule.close_minute!)}`}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <form
          key={`${edit.barber.id}-${edit.day}`}
          className="staff-form inline-editor"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const off = form.get("off") === "on";
            await act("/api/staff/settings", {
              action: "schedule",
              barber_id: edit.barber.id,
              iso_weekday: edit.day,
              open_minute: off ? null : minuteOf(form.get("open")),
              close_minute: off ? null : minuteOf(form.get("close")),
            });
            setEdit(null);
            reload();
          }}
        >
          <p className="wide editor-title">
            {edit.barber.name} on {WEEKDAYS[edit.day - 1]}s
          </p>
          <label>
            Start
            <input
              name="open"
              type="time"
              step="900"
              defaultValue={
                editing?.open_minute != null
                  ? inputTime(editing.open_minute)
                  : "09:00"
              }
            />
          </label>
          <label>
            Finish
            <input
              name="close"
              type="time"
              step="900"
              defaultValue={
                editing?.close_minute != null
                  ? inputTime(editing.close_minute)
                  : "18:00"
              }
            />
          </label>
          <label className="check wide">
            <input
              type="checkbox"
              name="off"
              defaultChecked={Boolean(editing) && editing?.open_minute === null}
            />
            <span>Day off</span>
          </label>
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={busy}>
              Save shift
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setEdit(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
