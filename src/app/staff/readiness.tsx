"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";

type ReadinessData = {
  checks: { label: string; ready: boolean }[];
  jobs: {
    id: string;
    kind: string;
    channel: string;
    status: string;
    due_at: string;
    last_error: string | null;
  }[];
  counts?: { stale: number; pending: number; failed: number };
  failures?: { error: string; count: number }[];
  sending?: boolean;
  note: string;
};

export function Readiness() {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const load = useCallback(
    () =>
      api("/api/staff/readiness")
        .then((d) => {
          setData(d as ReadinessData);
          setError("");
        })
        .catch((e) => setError((e as Error).message)),
    [],
  );
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  const run = async (action: "clear_stale" | "retry_failed" | "send_now") => {
    setBusy(true);
    setResult("");
    try {
      const r = (await api("/api/staff/readiness", { action })) as {
        cleared?: number;
        retried?: number;
        sent?: number;
        failed?: number;
      };
      setResult(
        action === "clear_stale"
          ? `Cleared ${r.cleared ?? 0} old message${r.cleared === 1 ? "" : "s"}.`
          : action === "retry_failed"
            ? `${r.retried ?? 0} message${r.retried === 1 ? "" : "s"} back in the queue. The sender picks them up on its next run, or use Send now.`
            : `Sent ${r.sent ?? 0}, failed ${r.failed ?? 0}. Up to fifty a tap; tap again for more.`,
      );
      await load();
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!data)
    return (
      <p role="status" className="staff-muted">
        {error || "Checking setup…"}
      </p>
    );
  const ready = data.checks.filter((check) => check.ready).length;
  const counts = data.counts ?? { stale: 0, pending: 0, failed: 0 };
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
          <span>{counts.stale + counts.pending + counts.failed}</span>
        </header>
        <p className="queue-summary">
          {counts.stale} more than an hour overdue (the sender missed them, so
          they are safe to clear). {counts.pending} due or due soon.{" "}
          {counts.failed} failed.{" "}
          {data.sending
            ? "Sending is on."
            : "Sending is switched off in Vercel (NOTIFICATIONS_ENABLED), so nothing goes out until it is on."}
        </p>
        {data.failures && data.failures.length > 0 && (
          <ul className="queue-reasons">
            {data.failures.map((f) => (
              <li key={f.error}>
                <strong>{f.count}</strong> {f.error}
              </li>
            ))}
          </ul>
        )}
        <div className="queue-actions">
          <button
            type="button"
            className="button-secondary"
            disabled={busy || counts.stale === 0}
            onClick={() => void run("clear_stale")}
          >
            Clear old messages
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy || counts.failed === 0}
            onClick={() => void run("retry_failed")}
          >
            Retry failed
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy || !data.sending}
            onClick={() => void run("send_now")}
          >
            Send now
          </button>
        </div>
        {result && (
          <p className="queue-result" role="status">
            {result}
          </p>
        )}
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
        {health.failed > 0 && (
          <>
            <strong>
              {health.failed} message{health.failed === 1 ? "" : "s"} failed to
              send.
            </strong>{" "}
          </>
        )}
        {health.delayed > 0 &&
          `${health.delayed} message${health.delayed === 1 ? " is" : "s are"} waiting to go out. Old ones can be cleared under Launch checks; if the number keeps growing, the once-a-minute sender is not running.`}
      </span>
      <button type="button" className="text-button" onClick={onReview}>
        Review messages
      </button>
    </div>
  );
}
