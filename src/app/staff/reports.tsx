"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { clock } from "@/lib/booking-data";
import { pounds, shortDay } from "./types";
import { Loading } from "./spinner";

type Report = {
  period: string;
  days: number;
  trims: number;
  completed: number;
  noShows: number;
  noShowRate: number | null;
  cancelled: number;
  completedValue: number;
  fees: number;
  rebooking: { clients: number; returning: number };
  hours: { hour: number; trims: number }[];
  weekdays: { name: string; trims: number; openDays: number; perDay: number }[];
  dayCounts?: Record<string, number>;
  byBarber?: {
    name: string;
    trims: number;
    completed: number;
    noShows: number;
    noShowRate: number | null;
    cancelled: number;
    completedValue: number;
  }[];
};

const PERIODS = [
  [30, "30 days"],
  [90, "3 months"],
  [365, "A year"],
] as const;

/** A row of a bar chart: label, bar, number. Bars are relative to the biggest in the set. */
function Bars({
  rows,
  max,
}: {
  rows: { label: string; value: number; note?: string }[];
  max: number;
}) {
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{
                width: `${max ? Math.round((r.value / max) * 100) : 0}%`,
              }}
            />
          </span>
          <span className="bar-value">
            {r.value}
            {r.note ? <small> {r.note}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Reports() {
  const [days, setDays] = useState<number>(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      api("/api/staff/reports?days=" + days)
        .then((r) => {
          if (live) setReport(r);
        })
        .catch((e) => {
          if (live) setError((e as Error).message);
        });
    }, 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [days]);
  if (!report) return <Loading>{error || "Adding it up…"}</Loading>;
  const recent = Object.entries(report.dayCounts ?? {})
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 14);
  const busiest = [...report.hours].sort((a, b) => b.trims - a.trims)[0];
  const quietest = [...report.weekdays]
    .filter((d) => d.openDays > 0)
    .sort((a, b) => a.perDay - b.perDay)[0];
  const rebookRate = report.rebooking.clients
    ? Math.round((report.rebooking.returning / report.rebooking.clients) * 100)
    : null;
  return (
    <div className="reports">
      <header className="sec-head">
        <h2>{report.period}.</h2>
        <div className="seg" role="group" aria-label="Period">
          {PERIODS.map(([n, label]) => (
            <button
              key={n}
              type="button"
              aria-pressed={days === n}
              onClick={() => setDays(n)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="stat-row">
        {[
          ["Trims in the diary", report.trims],
          ["Completed", report.completed],
          ["Completed value (pounds)", pounds(report.completedValue)],
          [
            "No shows",
            report.noShowRate === null
              ? report.noShows
              : `${report.noShows} (${report.noShowRate}%)`,
          ],
          ["Cancellations", report.cancelled],
          [
            "Came back for another",
            rebookRate === null
              ? "No data yet"
              : `${rebookRate}% of ${report.rebooking.clients}`,
          ],
          ["Fees collected (pounds)", pounds(report.fees)],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="staff-muted">
        {busiest ? `Busiest hour: ${clock(busiest.hour * 60)}. ` : ""}
        {quietest
          ? `Quietest day: ${quietest.name}, about ${quietest.perDay} trims a day. `
          : ""}
        “Came back” counts clients with a finished trim in the period who had at
        least one more in the same period.
      </p>

      {report.byBarber && report.byBarber.length > 0 && (
        <div className="grid-wrap">
          <table className="grid-table by-barber">
            <caption className="sr-only">Figures per chair</caption>
            <thead>
              <tr>
                <th scope="col">Chair</th>
                <th scope="col">Trims</th>
                <th scope="col">Completed</th>
                <th scope="col">No shows</th>
                <th scope="col">Cancelled</th>
                <th scope="col">Value (pounds)</th>
              </tr>
            </thead>
            <tbody>
              {report.byBarber.map((row) => (
                <tr key={row.name}>
                  <th scope="row">{row.name}</th>
                  <td>{row.trims}</td>
                  <td>{row.completed}</td>
                  <td>
                    {row.noShows}
                    {row.noShowRate !== null && (
                      <small className="staff-muted"> {row.noShowRate}%</small>
                    )}
                  </td>
                  <td>{row.cancelled}</td>
                  <td>{pounds(row.completedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="report-panels">
        <section className="staff-panel">
          <h2>Busiest hours.</h2>
          {report.hours.length === 0 ? (
            <p className="staff-muted">Nothing in the diary for this period.</p>
          ) : (
            <Bars
              rows={report.hours.map((h) => ({
                label: clock(h.hour * 60),
                value: h.trims,
              }))}
              max={Math.max(...report.hours.map((h) => h.trims))}
            />
          )}
        </section>
        <section className="staff-panel">
          <h2>Days of the week.</h2>
          <Bars
            rows={report.weekdays.map((d) => ({
              label: d.name.slice(0, 3),
              value: d.trims,
              note: d.openDays ? `· ${d.perDay} a day` : "· closed",
            }))}
            max={Math.max(...report.weekdays.map((d) => d.trims), 1)}
          />
        </section>
      </div>

      {recent.length > 0 && (
        <table className="day-table">
          <caption className="sr-only">
            Trims per day, most recent first
          </caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Trims</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(([day, count]) => (
              <tr key={day}>
                <td>{shortDay(day)}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="staff-muted">
        Completed value is what was booked, not what the till took. Fees only
        count once a card has been charged.
      </p>
    </div>
  );
}
