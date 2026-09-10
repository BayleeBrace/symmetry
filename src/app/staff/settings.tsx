"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { type Act } from "./types";
import { Account } from "./account";
import { Readiness } from "./readiness";
import { type Theme, THEME_LABEL, applyTheme, readTheme } from "./theme";
import { NotificationSettings } from "./notify";

export type SettingsTab = "account" | "notify" | "policy" | "checks";

type Policy = {
  cancellation_hours: number;
  late_percent: number;
  no_show_percent: number;
  policy_confirmed: boolean;
};

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
  const current =
    !owner && tab !== "account" && tab !== "notify" ? "account" : tab;
  return (
    <section className="settings" aria-label="Settings">
      <header className="sec-head">
        <h1>Settings</h1>
        <div className="seg" role="group" aria-label="Settings pages">
          <button
            type="button"
            aria-pressed={current === "account"}
            onClick={() => onTab("account")}
          >
            Your account
          </button>
          <button
            type="button"
            aria-pressed={current === "notify"}
            onClick={() => onTab("notify")}
          >
            Notifications
          </button>
          {owner && (
            <>
              <button
                type="button"
                aria-pressed={current === "policy"}
                onClick={() => onTab("policy")}
              >
                Cancellation policy
              </button>
              <button
                type="button"
                aria-pressed={current === "checks"}
                onClick={() => onTab("checks")}
              >
                Launch checks
              </button>
            </>
          )}
        </div>
      </header>
      {current === "account" && (
        <>
          <Appearance />
          <Account owner={owner} name={name} />
        </>
      )}
      {current === "notify" && <NotificationSettings />}
      {current === "policy" && owner && <PolicyForm act={act} busy={busy} />}
      {current === "checks" && owner && <Readiness />}
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
  const [saved, setSaved] = useState("");
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
  if (!policy)
    return (
      <p role="status" className="staff-muted">
        {error || "Loading…"}
      </p>
    );
  return (
    <div className="settings-block">
      <p className="staff-muted">
        Changes apply to new bookings. Existing bookings keep the policy
        accepted at checkout.
      </p>
      <form
        className="staff-form policy-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setSaved("");
          await act("/api/staff/settings", {
            action: "policy",
            cancellation_hours: Number(form.get("hours")),
            late_percent: Number(form.get("late")),
            no_show_percent: Number(form.get("noShow")),
            policy_confirmed: form.get("confirmed") === "on",
          });
          setSaved("Policy saved.");
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
          {saved && <span className="form-note">{saved}</span>}
        </div>
      </form>
    </div>
  );
}
