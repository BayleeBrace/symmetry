"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { addDays, clock, shopToday } from "@/lib/booking-data";
import { type Context, pounds, shortDay, weekStart } from "./types";
import { Loading } from "./loading";

type Row = {
  id: string;
  local_date: string;
  start_minute: number;
  status: string;
  price_pence: number;
  fee_pence: number;
  fee_status: string;
  paid_by: string | null;
  barber: string;
  service: string;
  client: string;
};
type Report = {
  from: string;
  to: string;
  rows: Row[];
  totals: {
    sales: number;
    trims: number;
    fees: number;
    noShows: number;
    byMethod: Record<string, number>;
    byBarber: { name: string; trims: number; sales: number }[];
  };
};

const RANGES = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "30", label: "Last 30 days" },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

function bounds(range: RangeId) {
  const today = shopToday();
  if (range === "today") return { from: today, to: today };
  if (range === "week") return { from: weekStart(today), to: today };
  if (range === "month") return { from: today.slice(0, 8) + "01", to: today };
  return { from: addDays(today, -29), to: today };
}

const METHOD: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  other: "Other",
  none: "Not recorded",
};

export function Sales({ ctx }: { ctx: Context }) {
  const owner = ctx.staff.role === "owner";
  const [range, setRange] = useState<RangeId>("today");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const { from, to } = bounds(range);
    api(`/api/staff/sales?from=${from}&to=${to}`)
      .then((d) => {
        if (live) {
          setReport(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [range]);
  const current = report && report.from === bounds(range).from ? report : null;
  return (
    <section className="sales" aria-label="Sales">
      <header className="sec-head">
        <h1>Sales</h1>
        <div className="range-chips" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={range === r.id}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {!current ? (
        <Loading>Adding it up…</Loading>
      ) : (
        <>
          <div className="stat-row">
            {[
              ["Sales (pounds)", pounds(current.totals.sales)],
              ["Trims completed", String(current.totals.trims)],
              [
                "Average per trim (pounds)",
                current.totals.trims
                  ? pounds(
                      Math.round(current.totals.sales / current.totals.trims),
                    )
                  : "0",
              ],
              ["Fees charged (pounds)", pounds(current.totals.fees)],
            ].map(([label, value]) => (
              <div className="stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="sales-breakdown">
            <div>
              <h2>By payment</h2>
              <table className="day-table">
                <tbody>
                  {Object.entries(current.totals.byMethod).map(([m, v]) => (
                    <tr key={m}>
                      <td>{METHOD[m] ?? m}</td>
                      <td>{pounds(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {owner && current.totals.byBarber.length > 1 && (
              <div>
                <h2>By chair</h2>
                <table className="day-table">
                  <tbody>
                    {current.totals.byBarber.map((b) => (
                      <tr key={b.name}>
                        <td>
                          {b.name}
                          <small className="staff-muted"> · {b.trims}</small>
                        </td>
                        <td>{pounds(b.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <h2>Completed trims</h2>
          {!current.rows.length ? (
            <p className="staff-muted">Nothing completed in this period yet.</p>
          ) : (
            <div className="grid-wrap">
              <table className="grid-table sales-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Client</th>
                    <th scope="col">Service</th>
                    <th scope="col">Chair</th>
                    <th scope="col">Paid by</th>
                    <th scope="col" className="num">
                      Pounds
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {current.rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {shortDay(r.local_date)} · {clock(r.start_minute)}
                      </td>
                      <td>{r.client}</td>
                      <td>{r.service}</td>
                      <td>{r.barber}</td>
                      <td>{METHOD[r.paid_by ?? "none"]}</td>
                      <td className="num">{pounds(r.price_pence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="staff-muted">
            Sales are the booked prices of trims marked done. Fees only count
            once a card has been charged. No shows in this period:{" "}
            {current.totals.noShows}.
          </p>
        </>
      )}
    </section>
  );
}
