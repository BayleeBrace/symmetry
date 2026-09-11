"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { type Act } from "./types";
import { Account } from "./account";
import { Readiness } from "./readiness";
import { type Theme, THEME_LABEL, applyTheme, readTheme } from "./theme";
import { NotificationSettings } from "./notify";
import { toast } from "./toast";
import { Loading } from "./loading";

export type SettingsTab =
  "home" | "account" | "notify" | "appearance" | "policy" | "checks";

type Policy = {
  cancellation_hours: number;
  late_percent: number;
  no_show_percent: number;
  policy_confirmed: boolean;
};

/** One row per setting, like a phone's Settings app. Owner-only pages are marked. */
const PAGES: {
  id: Exclude<SettingsTab, "home">;
  title: string;
  detail: string;
  owner?: boolean;
}[] = [
  {
    id: "account",
    title: "Your account",
    detail: "Who you are signed in as, and your password.",
  },
  {
    id: "notify",
    title: "Notifications",
    detail: "Turn them on for this phone, choose what you get, send a test.",
  },
  {
    id: "appearance",
    title: "Appearance",
    detail: "Light, dark, or with the phone.",
  },
  {
    id: "policy",
    title: "Cancellation policy",
    detail: "Notice period, late cancellation and no-show charges.",
    owner: true,
  },
  {
    id: "checks",
    title: "Launch checks",
    detail: "Set-up checks and the message queue.",
    owner: true,
  },
];

export function SettingsSection({
  owner,
  name,
  act,
  busy,
  tab,
  onTab,
}: {
  owner: boolean;
  name: string;
  act: Act;
  busy: boolean;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
}) {
  const pages = PAGES.filter((p) => owner || !p.owner);
  const page = pages.find((p) => p.id === tab);
  if (!page)
    return (
      <section className="settings" aria-label="Settings">
        <header className="sec-head">
          <h1>Settings</h1>
        </header>
        <ul className="settings-list">
          {pages.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onTab(p.id)}>
                <span>
                  <strong>{p.title}</strong>
                  <small>{p.detail}</small>
                </span>
                <span className="chev" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  return (
    <section className="settings" aria-label={page.title}>
      <button
        type="button"
        className="settings-back"
        onClick={() => onTab("home")}
      >
        <span aria-hidden="true">‹</span> Settings
      </button>
      <header className="sec-head">
        <h1>{page.title}</h1>
      </header>
      {page.id === "account" && <Account owner={owner} name={name} />}
      {page.id === "notify" && <NotificationSettings />}
      {page.id === "appearance" && <Appearance />}
      {page.id === "policy" && <PolicyForm act={act} busy={busy} />}
      {page.id === "checks" && <Readiness />}
    </section>
  );
}

/** Light, dark, or with the phone. Kept on this device, not the account. */
function Appearance() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof window === "undefined" ? "auto" : readTheme(),
  );
  return (
    <section className="staff-panel appearance">
      <h2>Appearance.</h2>
      <p>
        Light or dark, or let it follow the phone. Remembered on this device.
      </p>
      <div className="seg" role="group" aria-label="Appearance">
        {(["light", "dark", "auto"] as Theme[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={theme === t}
            onClick={() => {
              setTheme(t);
              applyTheme(t);
            }}
          >
            {THEME_LABEL[t]}
          </button>
        ))}
      </div>
    </section>
  );
}

function PolicyForm({ act, busy }: { act: Act; busy: boolean }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    api("/api/staff/settings")
      .then((d) => {
        setPolicy(d.policy);
        setError("");
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    const t = setTimeout(reload, 0);
    return () => clearTimeout(t);
  }, [reload]);
  if (!policy) return <Loading>{error || "Loading…"}</Loading>;
  return (
    <div className="staff-panel settings-block">
      <p className="staff-muted">
        Changes apply to new bookings. Existing bookings keep the policy
        accepted at checkout.
      </p>
      <form
        className="staff-form policy-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await act("/api/staff/settings", {
            action: "policy",
            cancellation_hours: Number(form.get("hours")),
            late_percent: Number(form.get("late")),
            no_show_percent: Number(form.get("noShow")),
            policy_confirmed: form.get("confirmed") === "on",
          });
          toast("Policy saved.");
          reload();
        }}
      >
        <label>
          Free cancellation notice (hours)
          <input
            name="hours"
            type="number"
            min="0"
            max="168"
            defaultValue={policy.cancellation_hours}
          />
        </label>
        <label>
          Late cancellation (%)
          <input
            name="late"
            type="number"
            min="0"
            max="100"
            defaultValue={policy.late_percent}
          />
        </label>
        <label>
          No-show (%)
          <input
            name="noShow"
            type="number"
            min="0"
            max="100"
            defaultValue={policy.no_show_percent}
          />
        </label>
        <label className="check wide">
          <input
            type="checkbox"
            name="confirmed"
            defaultChecked={policy.policy_confirmed}
          />
          <span>I confirm this is the shop’s policy</span>
        </label>
        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={busy}>
            Save policy
          </button>
        </div>
      </form>
    </div>
  );
}
