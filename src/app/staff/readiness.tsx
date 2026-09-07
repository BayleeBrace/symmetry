"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";

export function Readiness() {
  const [data, setData] = useState<{
    checks: { label: string; ready: boolean }[];
    jobs: {
      id: string;
      kind: string;
      channel: string;
      status: string;
      due_at: string;
      last_error: string | null;
    }[];
    note: string;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      api("/api/staff/readiness")
        .then(setData)
        .catch((e) => setError((e as Error).message));
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (!data)
    return (
      <p role="status" className="staff-muted">
        {error || "Checking setup…"}
      </p>
    );
  const ready = data.checks.filter((check) => check.ready).length;
  return (
    <div className="readiness">
      <header className="readiness-header">
        <div>
          <h2>Ready for launch?</h2>
          <p className="staff-muted">{data.note}</p>
        </div>
        <div
          className="readiness-score"
          aria-label={`${ready} of ${data.checks.length} checks complete`}
        >
          <strong>
            {ready}/{data.checks.length}
          </strong>
          <span>Complete</span>
        </div>
      </header>
      <ul className="readiness-checks">
        {data.checks.map((c) => (
          <li className={c.ready ? "is-ready" : ""} key={c.label}>
            <span className="readiness-icon" aria-hidden="true">
              {c.ready ? "✓" : ""}
            </span>
            <span>
              <strong>{c.label}</strong>
              <small>{c.ready ? "Ready" : "Needs attention"}</small>
            </span>
          </li>
        ))}
      </ul>
      <section className="message-queue">
        <header>
          <h2>Message queue.</h2>
          <span>{data.jobs.length}</span>
        </header>
        {!data.jobs.length ? (
          <p className="queue-empty">
            Everything is clear. No pending or failed messages.
          </p>
        ) : (
          <div className="queue-list">
            {data.jobs.map((j) => (
              <article key={j.id}>
                <strong>
                  {j.kind.replaceAll("_", " ")} · {j.channel}
                </strong>
                <p>
                  {j.status} · due{" "}
                  {new Date(j.due_at).toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                  })}
                </p>
                {j.last_error && <p>{j.last_error}</p>}
              </article>
            ))}
          </div>
        )}
        <small>
          Check failed deliveries against the provider before retrying. The
          oldest 50 unsettled messages appear here.
        </small>
      </section>
    </div>
  );
}

export function DeliveryAlert({ onReview }: { onReview: () => void }) {
  const [health, setHealth] = useState<{
    failed: number;
    delayed: number;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () => {
      api("/api/staff/alerts")
        .then((d) => {
          setHealth(d);
          setError("");
        })
        .catch(() => setError("Message status could not be checked."));
    };
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (error)
    return (
      <div className="staff-notice" role="status">
        <span>{error}</span>
        <button type="button" className="text-button" onClick={onReview}>
          Check messages
        </button>
      </div>
    );
  if (!health || (!health.failed && !health.delayed)) return null;
  return (
    <div className="staff-notice" role="alert">
      <span>
        <strong>Messages need attention:</strong> {health.failed} failed,{" "}
        {health.delayed} delayed over 15 minutes.
      </span>
      <button type="button" className="text-button" onClick={onReview}>
        Review messages
      </button>
    </div>
  );
}
