"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { Loading } from "./loading";

type Automation = {
  key: string;
  label: string;
  description: string;
  status: "on" | "setup" | "off";
  detail: string;
};

export function Marketing() {
  const [data, setData] = useState<{
    automations: Automation[];
    optedIn: number;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      api("/api/staff/marketing")
        .then(setData)
        .catch((e) => setError((e as Error).message));
    }, 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <section className="staff-marketing" aria-label="Marketing">
      <header className="sec-head">
        <h1>Marketing</h1>
      </header>
      <p className="staff-muted">
        The messages that go out on their own. Nothing here sends bulk email:
        every message is tied to a real trim, or to a client who asked to be
        reminded.
      </p>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <Loading>Loading…</Loading>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <span>Clients who asked for reminders</span>
              <strong>{data.optedIn}</strong>
            </div>
          </div>
          <div className="auto-list">
            {data.automations.map((a) => (
              <article key={a.key} className={`auto status-${a.status}`}>
                <div>
                  <strong>{a.label}</strong>
                  <p>{a.description}</p>
                  <small>{a.detail}</small>
                </div>
                <span className="pill">
                  {a.status === "on"
                    ? "On"
                    : a.status === "setup"
                      ? "Needs setup"
                      : "Off"}
                </span>
              </article>
            ))}
          </div>
          <p className="staff-muted">
            “Needs setup” means the message is written and wired in, but the
            sending service is not configured on the live site yet. Settings,
            Launch checks says which.
          </p>
        </>
      )}
    </section>
  );
}
