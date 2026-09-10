"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser";
import {
  staffApi as api,
  StaffSignInRequired,
  resetStaffSession,
} from "@/lib/staff-client";
import { shopToday } from "@/lib/booking-data";
import { type Context, type Diary } from "./types";
import { Shell, type Section } from "./shell";
import { Calendar, type BookPrefill, type CalendarState } from "./calendar";
import { Clients } from "./clients";
import { Sales } from "./sales";
import { Payouts } from "./payouts";
import { Catalogue } from "./catalogue";
import { Team } from "./team";
import { Reports } from "./reports";
import { Marketing } from "./marketing";
import { SettingsSection, type SettingsTab } from "./settings";
import { DeliveryAlert } from "./readiness";

const VIEW_KEY = "symmetry-staff-view";
const MODE_KEY = "symmetry-staff-cal";

/** Sign-in calls go straight to fetch: there is no session to renew yet. */
async function post(url: string, data: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not sign in");
  return body;
}

export function StaffApp() {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>("calendar");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [prefill, setPrefill] = useState<BookPrefill | null>(null);
  // The plus in the tab bar opens the calendar's Add menu from any section.
  const [addOpen, setAddOpen] = useState(false);
  const [faceId] = useState(
    () => typeof window !== "undefined" && browserSupportsWebAuthn(),
  );
  const [cal, setCal] = useState<CalendarState>(() => {
    let view: CalendarState["view"] = "day";
    let mine = false;
    try {
      view = localStorage.getItem(MODE_KEY) === "week" ? "week" : "day";
      mine = localStorage.getItem(VIEW_KEY) === "mine";
    } catch {}
    return { date: shopToday(), view, team: mine ? "mine" : "all" };
  });

  const load = useCallback(async () => {
    try {
      const d = (await api("/api/staff/diary?date=" + shopToday())) as Diary;
      setCtx({
        staff: d.staff,
        barbers: d.barbers,
        services: d.services,
        prices: d.prices,
      });
      setError("");
    } catch (e) {
      if (e instanceof StaffSignInRequired) {
        setCtx(null);
        setError("");
      } else setError((e as Error).message);
    } finally {
      setChecked(true);
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act(url: string, data: unknown) {
    setBusy(true);
    setError("");
    try {
      return await api(url, data);
    } catch (e) {
      if (e instanceof StaffSignInRequired) setCtx(null);
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  const updateCal = (next: Partial<CalendarState>) => {
    setCal((c) => {
      const merged = { ...c, ...next };
      try {
        localStorage.setItem(MODE_KEY, merged.view);
        if (merged.team === "mine" || merged.team === "all")
          localStorage.setItem(VIEW_KEY, merged.team);
      } catch {}
      return merged;
    });
  };

  if (!checked)
    return (
      <section
        className="staff-splash"
        role="status"
        aria-label="Opening the diary"
      >
        <img src="/symmetry-monogram-black.svg" alt="" />
        <span className="splash-word">Symmetry</span>
        <span className="splash-note">Opening the diary</span>
      </section>
    );

  if (!ctx)
    return (
      <section className="staff-signin">
        <img
          className="signin-mark"
          src="/symmetry-monogram-black.svg"
          alt=""
        />
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
              if (err instanceof StaffSignInRequired) setCtx(null);
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
        {faceId && (
          <button
            type="button"
            className="button-secondary faceid-button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const optionsJSON = await post("/api/staff/passkey", {
                  action: "login-options",
                });
                const response = await startAuthentication({ optionsJSON });
                await post("/api/staff/passkey", {
                  action: "login-verify",
                  response,
                });
                resetStaffSession();
                await load();
              } catch (e) {
                const err = e as Error & { name?: string };
                setError(
                  err.name === "NotAllowedError"
                    ? "Face ID was cancelled or timed out. Try again, or use your password."
                    : err.message,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign in with Face ID
          </button>
        )}
        {error && (
          <p role="alert" className="staff-error">
            {error}
          </p>
        )}
        <Link className="signin-back" href="/">
          Back to the site
        </Link>
      </section>
    );

  const owner = ctx.staff.role === "owner";
  const chairs = ctx.barbers.filter((b) => b.active !== false);
  const me = chairs.find((b) => b.id === ctx.staff.barber_id);
  const name = me ? me.name : owner ? "Owner" : "Staff";

  return (
    <Shell
      section={section}
      onSection={(next) => {
        setSection(next);
        setAddOpen(false);
      }}
      onAdd={() => {
        setSection("calendar");
        setAddOpen(true);
      }}
      owner={owner}
      name={name}
      onSignOut={async () => {
        const r = await fetch("/api/staff/session", { method: "DELETE" });
        resetStaffSession();
        setCtx(null);
        if (!r.ok) setError((await r.json()).error);
      }}
    >
      {owner && (
        <DeliveryAlert
          onReview={() => {
            setSettingsTab("checks");
            setSection("settings");
          }}
        />
      )}
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {section === "calendar" && (
        <Calendar
          ctx={ctx}
          act={act}
          busy={busy}
          state={cal}
          onState={updateCal}
          prefill={prefill}
          onPrefillUsed={() => setPrefill(null)}
          addOpen={addOpen}
          onAddOpen={setAddOpen}
        />
      )}
      {section === "clients" && (
        <Clients
          ctx={ctx}
          onBook={(client) => {
            setPrefill({ client });
            setSection("calendar");
          }}
        />
      )}
      {section === "sales" && <Sales ctx={ctx} />}
      {section === "payouts" && <Payouts ctx={ctx} />}
      {section === "catalogue" && owner && (
        <Catalogue ctx={ctx} act={act} busy={busy} reload={load} />
      )}
      {section === "team" && owner && <Team ctx={ctx} act={act} busy={busy} />}
      {section === "reports" && <Reports />}
      {section === "marketing" && owner && <Marketing />}
      {section === "settings" && (
        <SettingsSection
          owner={owner}
          name={name}
          act={act}
          busy={busy}
          tab={settingsTab}
          onTab={setSettingsTab}
        />
      )}
    </Shell>
  );
}
