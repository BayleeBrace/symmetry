"use client";
import Link from "next/link";
import { type ReactNode, useState } from "react";

export type Section =
  | "calendar"
  | "clients"
  | "sales"
  | "payouts"
  | "catalogue"
  | "team"
  | "reports"
  | "marketing"
  | "settings";

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
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

export const SECTIONS: {
  id: Section;
  label: string;
  owner?: boolean;
  icon: ReactNode;
}[] = [
  {
    id: "calendar",
    label: "Calendar",
    icon: (
      <Icon d="M4 6.5h16M7 3v3M17 3v3M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 11h3M8 15h3M13 11h3M13 15h3" />
    ),
  },
  {
    id: "clients",
    label: "Clients",
    icon: (
      <Icon d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1.3a3.5 3.5 0 0 0-2.5-3.3M15 4.2a3.5 3.5 0 0 1 0 6.6" />
    ),
  },
  {
    id: "sales",
    label: "Sales",
    icon: (
      <Icon d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21V3zM9 8h6M9 12h6M9 16h4" />
    ),
  },
  {
    id: "payouts",
    label: "Payouts",
    icon: (
      <Icon d="M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 12h.01M18 12h.01" />
    ),
  },
  {
    id: "catalogue",
    label: "Catalogue",
    owner: true,
    icon: <Icon d="M4 5h16M4 12h16M4 19h16M8 5v14M14 5v14" />,
  },
  {
    id: "team",
    label: "Team",
    owner: true,
    icon: <Icon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0" />,
  },
  {
    id: "reports",
    label: "Reports",
    icon: <Icon d="M4 20h16M6 16V9M11 16V5M16 16v-7M21 16v-3" />,
  },
  {
    id: "marketing",
    label: "Marketing",
    owner: true,
    icon: (
      <Icon d="M4 10v4a1 1 0 0 0 1 1h3l6 4V5l-6 4H5a1 1 0 0 0-1 1zM17 9.5a3.5 3.5 0 0 1 0 5M8 15v5" />
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    ),
  },
];

const PHONE_TABS: Section[] = ["calendar", "clients", "sales"];

export function Shell({
  section,
  onSection,
  owner,
  name,
  onSignOut,
  children,
}: {
  section: Section;
  onSection: (section: Section) => void;
  owner: boolean;
  name: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [more, setMore] = useState(false);
  const visible = SECTIONS.filter((s) => owner || !s.owner);
  const moreSections = visible.filter((s) => !PHONE_TABS.includes(s.id));
  const pick = (id: Section) => {
    onSection(id);
    setMore(false);
  };
  return (
    <div className="staff-app">
      <nav className="rail" aria-label="Staff sections">
        <Link className="rail-mark" href="/" title="Back to the site">
          <img src="/symmetry-monogram-black.svg" alt="Symmetry" />
        </Link>
        <div className="rail-items">
          {visible.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={section === s.id}
              onClick={() => pick(s.id)}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        </div>
        <div className="rail-foot">
          <span className="rail-who" title={name}>
            {name}
          </span>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </nav>

      <div className="staff-main">{children}</div>

      <nav className="tabbar" aria-label="Staff sections">
        {visible
          .filter((s) => PHONE_TABS.includes(s.id))
          .map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={section === s.id && !more}
              onClick={() => pick(s.id)}
            >
              {s.icon}
              <span>{s.label}</span>
            </button>
          ))}
        <button
          type="button"
          aria-pressed={more || moreSections.some((s) => s.id === section)}
          aria-expanded={more}
          onClick={() => setMore((m) => !m)}
        >
          <Icon d="M5 12h.01M12 12h.01M19 12h.01" />
          <span>More</span>
        </button>
      </nav>

      {more && (
        <>
          <div className="sheet-backdrop" onClick={() => setMore(false)} />
          <div className="more-sheet" role="dialog" aria-label="More">
            <p className="more-who">{name}</p>
            {moreSections.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={section === s.id}
                onClick={() => pick(s.id)}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
            <Link href="/">Back to the site</Link>
            <button type="button" className="more-signout" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
