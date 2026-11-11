"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { syncThemeColor } from "./theme";
import { toast } from "./toast";

const VIEW_KEY = "symmetry-staff-view";
const MODE_KEY = "symmetry-staff-cal";
const PULL_TO_REFRESH = 72;

/**
 * Pull down from the top of the page to reload the whole app, the way a
 * native app does. A Home Screen app has no address bar to refresh from.
 */
function usePullToRefresh(enabled: boolean) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let startY: number | null = null;
    // Not over a sheet, an editor or a drag: a reload there would lose what was typed.
    const blocked = () =>
      Boolean(
        document.querySelector(
          ".sheet-backdrop, .inline-editor, .editor-backdrop, .is-drag-active",
        ),
      );
    /** The finger is in a list or sheet that has scrolled: that scrolls back, it does not refresh. */
    const scrolledInside = (target: EventTarget | null) => {
      for (
        let el = target instanceof Element ? target : null;
        el && el !== document.body;
        el = el.parentElement
      )
        if (el.scrollTop > 0) return true;
      return false;
    };
    const set = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };
    const onStart = (event: TouchEvent) => {
      startY =
        event.touches.length === 1 &&
        window.scrollY <= 0 &&
        !blocked() &&
        !scrolledInside(event.target)
          ? event.touches[0].clientY
          : null;
    };
    const onMove = (event: TouchEvent) => {
      if (startY === null) return;
      if (blocked()) {
        startY = null;
        set(0);
        return;
      }
      const dy = event.touches[0].clientY - startY;
      if (dy > 12 && window.scrollY <= 0) set(Math.min(120, (dy - 12) * 0.6));
      else if (pullRef.current) set(0);
    };
    const onEnd = () => {
      if (startY !== null && pullRef.current >= PULL_TO_REFRESH) {
        setRefreshing(true);
        window.location.reload();
        return;
      }
      startY = null;
      set(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled]);
  return { pull, refreshing };
}

/**
 * Signing out of a shared phone stops this account's notifications on it.
 * Best effort and quick: sign-out goes ahead whatever happens here.
 */
async function forgetThisPhone() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await Promise.race([
      navigator.serviceWorker.getRegistration(),
      new Promise<undefined>((done) => setTimeout(() => done(undefined), 2000)),
    ]);
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) return;
    await Promise.race([
      api("/api/staff/notify", {
        action: "forget",
        endpoint: sub.endpoint,
      }).catch(() => {}),
      new Promise((done) => setTimeout(done, 3000)),
    ]);
    // Even if the server did not hear, a dropped subscription can no longer reach this phone.
    await sub.unsubscribe();
  } catch {}
}

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
  // A push notification can open straight onto Payouts or Sales.
  const [section, setSection] = useState<Section>(() => {
    try {
      const asked = new URLSearchParams(window.location.search).get("section");
      if (
        asked &&
        ["clients", "sales", "payouts", "reports", "settings"].includes(asked)
      )
        return asked as Section;
    } catch {}
    return "calendar";
  });
  // Stripe's sign-up sends a barber back to ?section=settings&tab=payments.
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(() => {
    try {
      const asked = new URLSearchParams(window.location.search).get("tab");
      if (asked === "payments" || asked === "help") return asked;
    } catch {}
    return "home";
  });
  const [prefill, setPrefill] = useState<BookPrefill | null>(null);
  // The plus in the tab bar opens the calendar's Add menu from any section.
  const [addOpen, setAddOpen] = useState(false);
  const [faceId] = useState(
    () => typeof window !== "undefined" && browserSupportsWebAuthn(),
  );
  const [cal, setCal] = useState<CalendarState>(() => {
    let view: CalendarState["view"] = "day";
    let mine = false;
    let date = shopToday();
    try {
      view = localStorage.getItem(MODE_KEY) === "week" ? "week" : "day";
      // Your own chair first; "All chairs" is remembered once chosen.
      mine = localStorage.getItem(VIEW_KEY) !== "all";
      // A push notification opens the diary on the day it was about.
      const asked = new URLSearchParams(window.location.search).get("date");
      if (asked && /^\d{4}-\d{2}-\d{2}$/.test(asked)) date = asked;
    } catch {}
    return { date, view, team: mine ? "mine" : "all" };
  });

  // A notification's ?date= and ?section= are read once; a later refresh opens where the app was left.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("date") && !url.searchParams.has("section"))
        return;
      url.searchParams.delete("date");
      url.searchParams.delete("section");
      url.searchParams.delete("tab");
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
    } catch {}
  }, []);

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
  // The status bar colour follows the theme, including when the phone switches at dusk.
  // The html flag keeps the dark ground to the staff app; the public site stays as it is.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.staffPage = "1";
    const dusk = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => syncThemeColor();
    sync();
    dusk.addEventListener("change", sync);
    return () => {
      dusk.removeEventListener("change", sync);
      delete root.dataset.staffPage;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", "#161616");
    };
  }, []);

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

  const { pull, refreshing } = usePullToRefresh(Boolean(ctx));
  // Anything that goes wrong after sign-in drops down as a red band.
  useEffect(() => {
    if (error && ctx) toast(error, "error");
  }, [error, ctx]);

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
        <div className="splash-stage">
          <div className="splash-mark">
            <img src="/symmetry-wordmark.svg" alt="Symmetry" />
          </div>
          <span className="splash-cut" aria-hidden="true" />
          <span className="splash-note">Opening the diary</span>
        </div>
      </section>
    );

  if (!ctx)
    return (
      <section className="staff-signin">
        <img
          className="signin-mark on-light"
          src="/symmetry-monogram-black.svg"
          alt=""
        />
        <img
          className="signin-mark on-dark"
          src="/symmetry-monogram.svg"
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

  const signOut = async () => {
    await forgetThisPhone();
    const r = await fetch("/api/staff/session", { method: "DELETE" });
    resetStaffSession();
    setCtx(null);
    if (!r.ok) setError((await r.json()).error);
  };

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
      onMore={() => {
        setSettingsTab("home");
        setSection("settings");
        setAddOpen(false);
      }}
      owner={owner}
      name={name}
      onSignOut={signOut}
    >
      <div
        className={`pull-refresh ${pull > 0 || refreshing ? "is-visible" : ""}`}
        style={{ transform: `translate(-50%, ${Math.min(pull, 90) - 60}px)` }}
        aria-hidden="true"
      >
        {refreshing
          ? "Refreshing…"
          : pull >= PULL_TO_REFRESH
            ? "Let go to refresh"
            : "Pull to refresh"}
      </div>
      {owner && (
        <DeliveryAlert
          onReview={() => {
            setSettingsTab("checks");
            setSection("settings");
          }}
        />
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
          onSignedOut={() => setCtx(null)}
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
          onSection={(next) => {
            setSection(next);
            setAddOpen(false);
          }}
          onSignOut={signOut}
        />
      )}
    </Shell>
  );
}
