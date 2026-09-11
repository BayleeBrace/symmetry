"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { pounds, shortDay } from "./types";
import { Loading } from "./loading";

type Report = {
  period: string;
  trims: number;
  completed: number;
  noShows: number;
  cancelled: number;
  completedValue: number;
  fees: number;
  days?: Record<string, number>;
  byBarber?: {
    name: string;
    trims: number;
    completed: number;
    noShows: number;
    cancelled: number;
    completedValue: number;
  }[];
};

export function Reports() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      api("/api/staff/reports")
        .then(setReport)
        .catch((e) => setError((e as Error).message));
    }, 0);
    return () => clearTimeout(t);
  }, []);
  if (!report) return <Loading>{error || "Adding it up…"}</Loading>;
  const days = Object.entries(report.days ?? {}).sort(([a], [b]) =>
    a < b ? 1 : -1,
  );
  return (
    <div className="reports">
      <h2>{report.period}.</h2>
      <div className="stat-row">
        {[
          ["Trims in the diary", report.trims],
          ["Completed", report.completed],
          ["Completed value (pounds)", pounds(report.completedValue)],
          ["No shows", report.noShows],
          ["Cancellations", report.cancelled],
          ["Fees collected (pounds)", pounds(report.fees)],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
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
                  <td>{row.noShows}</td>
                  <td>{row.cancelled}</td>
                  <td>{pounds(row.completedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {days.length > 0 && (
        <table className="day-table">
          <caption className="sr-only">Trims per day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Trims</th>
            </tr>
          </thead>
          <tbody>
            {days.map(([day, count]) => (
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
