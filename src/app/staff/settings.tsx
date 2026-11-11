"use client";
import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { type Act, initials } from "./types";
import { type Section, SECTIONS } from "./shell";
import { SheetIcon } from "./timeline";
import { Account } from "./account";
import { Readiness } from "./readiness";
import { type Theme, THEME_LABEL, applyTheme, readTheme } from "./theme";
import { NotificationSettings } from "./notify";
import { toast } from "./toast";
import { Loading } from "./spinner";
import { CardPayments } from "./card-payments";
import { Help } from "./help";

export type SettingsTab =
  | "home"
  | "help"
  | "account"
  | "notify"
  | "payments"
  | "appearance"
  | "policy"
  | "checks"
  | "exports";

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
    id: "help",
    title: "Help",
    detail: "How to do anything in the app. Search it.",
  },
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
    id: "payments",
    title: "Card payments",
    detail: "Your own payouts, the card machine, and practice mode.",
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
  {
    id: "exports",
    title: "Your data",
    detail: "Download clients and bookings as spreadsheets.",
    owner: true,
  },
];

/** A line icon for each settings row. */
const PAGE_ICON: Record<Exclude<SettingsTab, "home">, string> = {
  help: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 16.8v.2",
  account:
    "M12 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5",
  notify: "M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  payments: "M3.5 6h17v12h-17zM3.5 10h17M7 14.5h4",
  appearance: "M12 3.5a8.5 8.5 0 1 1 0 17zM12 3.5a8.5 8.5 0 1 0 0 17",
  policy: "M3.5 5h17v15h-17zM3.5 10h17M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4",
  checks:
    "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zM8 12.5l2.8 2.8 5.7-5.8",
  exports: "M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 19.5h15",
};

const Chev = () => (
  <span className="chev" aria-hidden="true">
    <SheetIcon d="M9 5l7 7-7 7" />
  </span>
);

/** One row on the More page: an icon, a name, sometimes a value, and a chevron. */
function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick}>
        <span className="row-icon">{icon}</span>
        <strong>{label}</strong>
        {value && <span className="row-value">{value}</span>}
        <Chev />
      </button>
    </li>
  );
}

/** The shop's own data, as CSV files that open in Excel or Numbers. */
function Exports() {
  return (
    <section className="staff-panel">
      <h2>Your data.</h2>
      <p>
        Everything the app holds, as spreadsheets. Best done on a computer: a
        phone may open the file in a new tab instead of saving it.
      </p>
      <div className="form-actions">
        <a className="button-secondary" href="/api/staff/customers?format=csv">
          Download clients
        </a>
        <a
          className="button-secondary"
          href="/api/staff/reports?format=csv&days=365"
        >
          Download bookings, last year
        </a>
        <a
          className="button-secondary"
          href="/api/staff/reports?format=csv&days=730"
        >
          Bookings, two years
        </a>
      </div>
      <p className="staff-muted">
        Clients: name, mobile, email, notes, client since. Bookings: date, time,
        client, chair, trim, status, price, how it was paid, any fee charged.
      </p>
    </section>
  );
}

export function SettingsSection({
  owner,
  name,
  act,
  busy,
  tab,
  onTab,
  onSection,
  onSignOut,
}: {
  owner: boolean;
  name: string;
  act: Act;
  busy: boolean;
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  /** On a phone this page is also the More tab: the other sections open from here. */
  onSection: (section: Section) => void;
  onSignOut: () => void;
}) {
  const pages = PAGES.filter((p) => owner || !p.owner);
  const page = pages.find((p) => p.id === tab);
  const [theme] = useState<Theme>(() =>
    typeof window === "undefined" ? "auto" : readTheme(),
  );
  // The sections the phone's tab bar has no room for. The rail shows them on a computer.
  const more = SECTIONS.filter(
    (s) =>
      (owner || !s.owner) &&
      !["calendar", "clients", "sales", "settings"].includes(s.id),
  );
  if (!page)
    return (
      <section className="settings" aria-label="Settings">
        <header className="sec-head">
          <h1>
            <span className="phone-only">More</span>
            <span className="wide-only">Settings</span>
          </h1>
        </header>
        <button
          type="button"
          className="more-profile"
          onClick={() => onTab("account")}
        >
          <span className="avatar">{initials(name)}</span>
          <span>
            <strong>{name}</strong>
            <small>Your account and password</small>
          </span>
          <Chev />
        </button>
        {more.length > 0 && (
          <div className="more-group phone-only">
            <p className="more-label">The shop</p>
            <ul className="settings-list">
              {more.map((s) => (
                <Row
                  key={s.id}
                  icon={s.icon}
                  label={s.long ?? s.label}
                  onClick={() => onSection(s.id)}
                />
              ))}
            </ul>
          </div>
        )}
        <div className="more-group">
          <p className="more-label">Settings</p>
          <ul className="settings-list">
            {pages
              .filter((p) => p.id !== "account")
              .map((p) => (
                <Row
                  key={p.id}
                  icon={<SheetIcon d={PAGE_ICON[p.id]} />}
                  label={p.title}
                  value={p.id === "appearance" ? THEME_LABEL[theme] : undefined}
                  onClick={() => onTab(p.id)}
                />
              ))}
          </ul>
        </div>
        <div className="more-foot phone-only">
          <Link href="/">Back to the site</Link>
          <button type="button" className="more-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </section>
    );
  return (
    <section className="settings" aria-label={page.title}>
      <button
        type="button"
        className="settings-back"
        onClick={() => onTab("home")}
      >
        <SheetIcon d="M15 5l-7 7 7 7" />
        <span className="phone-only">More</span>
        <span className="wide-only">Settings</span>
      </button>
      <header className="sec-head">
        <h1>{page.title}</h1>
      </header>
      {page.id === "help" && <Help owner={owner} />}
      {page.id === "account" && <Account owner={owner} name={name} />}
      {page.id === "notify" && <NotificationSettings />}
      {page.id === "payments" && <CardPayments owner={owner} />}
      {page.id === "appearance" && <Appearance />}
      {page.id === "policy" && <PolicyForm act={act} busy={busy} />}
      {page.id === "checks" && <Readiness />}
      {page.id === "exports" && <Exports />}
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

/** A whole number from a policy field, or null when it is blank or out of range. */
function wholeNumber(value: FormDataEntryValue | null, max: number) {
  const text = String(value ?? "").trim();
  const n = Number(text);
  return text !== "" && Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

function PolicyForm({ act, busy }: { act: Act; busy: boolean }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState("");
  const [problem, setProblem] = useState("");
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
          const hours = wholeNumber(form.get("hours"), 168);
          const late = wholeNumber(form.get("late"), 100);
          const noShow = wholeNumber(form.get("noShow"), 100);
          if (hours === null || late === null || noShow === null) {
            setProblem(
              "Fill in every number: whole hours from 0 to 168, and percentages from 0 to 100.",
            );
            return;
          }
          setProblem("");
          try {
            await act("/api/staff/settings", {
              action: "policy",
              cancellation_hours: hours,
              late_percent: late,
              no_show_percent: noShow,
              policy_confirmed: form.get("confirmed") === "on",
            });
          } catch {
            return;
          }
          toast("Policy saved.");
          reload();
        }}
      >
        <label>
          Free cancellation notice (hours)
          <input
            name="hours"
            type="number"
            inputMode="numeric"
            required
            step="1"
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
            inputMode="numeric"
            required
            step="1"
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
            inputMode="numeric"
            required
            step="1"
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
        {problem && (
          <p className="staff-error wide" role="alert">
            {problem}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="button-primary" disabled={busy}>
            Save policy
          </button>
        </div>
      </form>
    </div>
  );
}
