"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { toast } from "./toast";

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
  const run = async (
    action: "clear_stale" | "clear_all" | "retry_failed" | "send_now",
  ) => {
    setBusy(true);
    try {
      const r = (await api("/api/staff/readiness", { action })) as {
        cleared?: number;
        retried?: number;
        sent?: number;
        failed?: number;
      };
      toast(
        action === "clear_stale" || action === "clear_all"
          ? `Cleared ${r.cleared ?? 0} message${r.cleared === 1 ? "" : "s"}.`
          : action === "retry_failed"
            ? `${r.retried ?? 0} message${r.retried === 1 ? "" : "s"} back in the queue. The sender picks them up on its next run, or use Send now.`
            : `Sent ${r.sent ?? 0}, failed ${r.failed ?? 0}. Up to fifty a tap; tap again for more.`,
      );
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
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
            disabled={busy || counts.pending + counts.stale === 0}
            onClick={() => {
              if (
                confirm(
                  "Cancel every waiting message, including reminders for upcoming trims? Use this to wipe test data noise.",
                )
              )
                void run("clear_all");
            }}
          >
            Clear everything waiting
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

/** One quiet line for the owner, only when messages have actually failed. Waiting ones live under Launch checks. */
export function DeliveryAlert({ onReview }: { onReview: () => void }) {
  const [health, setHealth] = useState<{
    failed: number;
    delayed: number;
  } | null>(null);
  const [hidden, setHidden] = useState<number | null>(() => {
    try {
      const h = sessionStorage.getItem("symmetry-alert-hidden");
      return h ? Number(h) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    const load = () => {
      api("/api/staff/alerts")
        .then((d) => setHealth(d))
        .catch(() => {});
    };
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  if (!health || !health.failed || hidden === health.failed) return null;
  return (
    <div className="staff-notice is-quiet" role="status">
      <span>
        {health.failed} message{health.failed === 1 ? "" : "s"} failed to send.
      </span>
      <button type="button" className="text-button" onClick={onReview}>
        Review
      </button>
      <button
        type="button"
        className="text-button"
        onClick={() => {
          setHidden(health.failed);
          try {
            sessionStorage.setItem(
              "symmetry-alert-hidden",
              String(health.failed),
            );
          } catch {}
        }}
      >
        Hide
      </button>
    </div>
  );
}
