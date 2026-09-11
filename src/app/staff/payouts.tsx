"use client";
import { useCallback, useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { addDays, shopToday } from "@/lib/booking-data";
import { type Context, initials, pounds, shortDay, weekStart } from "./types";
import { Loading } from "./spinner";

type Rule = {
  barber_id: string;
  share_percent: number;
  weekly_rent_pence: number;
  keeps_cash: boolean;
  bank_name: string;
  bank_sort_code: string;
  bank_account: string;
};
type Item = {
  barber: { id: string; name: string; owner: boolean };
  rule: Rule;
  trims: number;
  salesPence: number;
  cardPence: number;
  cashPence: number;
  unrecordedPence: number;
  grossPence: number;
  rentPence: number;
  rentWeeks: number;
  cashKeptPence: number;
  netPence: number;
  paid: {
    id: string;
    amount_pence: number;
    paid_at: string;
    note: string;
  } | null;
};
type Payout = {
  id: string;
  barber: string;
  period_start: string;
  period_end: string;
  amount_pence: number;
  note: string;
  paid_at: string;
};
type Report = {
  from: string;
  to: string;
  days: number;
  items: Item[];
  history: Payout[];
};

const RANGES = [
  { id: "week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Pick dates" },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

function bounds(range: RangeId, custom: { from: string; to: string }) {
  const today = shopToday();
  if (range === "week") return { from: weekStart(today), to: today };
  if (range === "last-week") {
    const start = addDays(weekStart(today), -7);
    return { from: start, to: addDays(start, 6) };
  }
  if (range === "month") return { from: today.slice(0, 8) + "01", to: today };
  return custom;
}

const money = (pence: number) =>
  (pence < 0 ? "-" : "") + pounds(Math.abs(pence));

export function Payouts({ ctx }: { ctx: Context }) {
  const owner = ctx.staff.role === "owner";
  const today = shopToday();
  const [range, setRange] = useState<RangeId>("week");
  const [custom, setCustom] = useState({ from: addDays(today, -6), to: today });
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const { from, to } = bounds(range, custom);

  const load = useCallback(() => {
    if (to < from) return;
    api(`/api/staff/payouts?from=${from}&to=${to}`)
      .then((d) => {
        setReport(d);
        setError("");
      })
      .catch((e) => setError((e as Error).message));
  }, [from, to]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act(data: unknown, done: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/api/staff/payouts", data);
      setNotice(done);
      setEditing(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const current =
    report && report.from === from && report.to === to ? report : null;
  const payable = current
    ? current.items.filter((i) => !i.barber.owner && !i.paid && i.netPence > 0)
    : [];
  const periodLabel = `${shortDay(from)} to ${shortDay(to)}`;

  return (
    <section className="payouts" aria-label="Payouts">
      <header className="sec-head">
        <h1>{owner ? "Payouts" : "Your pay"}</h1>
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
      {range === "custom" && (
        <form
          className="staff-form range-form"
          onSubmit={(e) => e.preventDefault()}
        >
          <label>
            From
            <input
              type="date"
              value={custom.from}
              max={custom.to}
              onChange={(e) =>
                e.target.value && setCustom({ ...custom, from: e.target.value })
              }
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={custom.to}
              min={custom.from}
              onChange={(e) =>
                e.target.value && setCustom({ ...custom, to: e.target.value })
              }
            />
          </label>
        </form>
      )}
      <p className="staff-muted">
        {periodLabel}. Sales are the booked prices of trims checked out on each
        chair, card and cash as chosen at Checkout. Cash stays with the barber,
        chair rent is taken once per week, and the rest of the card takings is
        what the shop pays over.
        {owner ? " Set each barber’s rent under their name." : ""}
      </p>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {notice && <Loading>{notice}</Loading>}
      {!current ? (
        <Loading>Adding it up…</Loading>
      ) : (
        <>
          {owner && (
            <div className="payout-actions">
              <button
                type="button"
                className="button-primary"
                disabled={busy || payable.length === 0}
                onClick={() => {
                  const total = payable.reduce((s, i) => s + i.netPence, 0);
                  if (
                    !confirm(
                      `Record ${payable.length} payout${payable.length === 1 ? "" : "s"} for ${periodLabel}, ${pounds(total)} pounds in total? This marks them paid; the money moves from your bank.`,
                    )
                  )
                    return;
                  void act(
                    {
                      action: "pay",
                      items: payable.map((i) => ({
                        barber_id: i.barber.id,
                        from,
                        to,
                        amount_pence: i.netPence,
                        sales_pence: i.salesPence,
                        card_pence: i.cardPence,
                        cash_pence: i.cashPence,
                        note: "",
                      })),
                    },
                    `Recorded ${payable.length} payout${payable.length === 1 ? "" : "s"} for ${periodLabel}.`,
                  );
                }}
              >
                Pay everyone
                {payable.length
                  ? ` · ${pounds(payable.reduce((s, i) => s + i.netPence, 0))}`
                  : ""}
              </button>
              <a
                className="button-secondary"
                href={`/api/staff/payouts?from=${from}&to=${to}&format=csv`}
              >
                Bank file
              </a>
            </div>
          )}
          <div className="payout-list">
            {current.items.map((i) => (
              <article
                key={i.barber.id}
                className={`payout ${i.paid ? "is-paid" : ""}`}
              >
                <header className="payout-head">
                  <span className="avatar">{initials(i.barber.name)}</span>
                  <div>
                    <strong>{i.barber.name}</strong>
                    <small>
                      {i.barber.owner
                        ? "Owner, the shop's takings"
                        : `Keeps ${i.rule.share_percent}%${i.rule.weekly_rent_pence ? ` · rent ${pounds(i.rule.weekly_rent_pence)} a week` : ""}${i.rule.keeps_cash ? " · keeps cash" : ""}`}
                    </small>
                  </div>
                  {!i.barber.owner && (
                    <span
                      className={`payout-net ${i.netPence < 0 ? "is-negative" : ""}`}
                    >
                      {money(i.netPence)}
                      <small>
                        {i.netPence < 0 ? "owes the shop" : "to pay"}
                      </small>
                    </span>
                  )}
                </header>
                <dl className="payout-figures">
                  <div>
                    <dt>Trims</dt>
                    <dd>{i.trims}</dd>
                  </div>
                  <div>
                    <dt>Sales</dt>
                    <dd>{pounds(i.salesPence)}</dd>
                  </div>
                  <div>
                    <dt>Card</dt>
                    <dd>{pounds(i.cardPence)}</dd>
                  </div>
                  <div>
                    <dt>Cash</dt>
                    <dd>{pounds(i.cashPence)}</dd>
                  </div>
                  {i.unrecordedPence > 0 && (
                    <div>
                      <dt>Not recorded</dt>
                      <dd>{pounds(i.unrecordedPence)}</dd>
                    </div>
                  )}
                  {!i.barber.owner && (
                    <>
                      <div>
                        <dt>Share</dt>
                        <dd>{pounds(i.grossPence)}</dd>
                      </div>
                      {i.rule.weekly_rent_pence > 0 && (
                        <div>
                          <dt>
                            Rent
                            {i.rentWeeks > 1 ? ` (${i.rentWeeks} weeks)` : ""}
                          </dt>
                          <dd>
                            {i.rentPence > 0
                              ? `-${pounds(i.rentPence)}`
                              : "Already charged"}
                          </dd>
                        </div>
                      )}
                      {i.cashKeptPence > 0 && (
                        <div>
                          <dt>Cash kept</dt>
                          <dd>-{pounds(i.cashKeptPence)}</dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
                {i.paid && (
                  <p className="payout-paid">
                    Paid {pounds(i.paid.amount_pence)} on{" "}
                    {new Date(i.paid.paid_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Europe/London",
                    })}
                    {i.paid.note ? ` · ${i.paid.note}` : ""}
                    {owner && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Undo this payout for ${i.barber.name}?`))
                            void act(
                              { action: "unpay", id: i.paid?.id },
                              `Payout for ${i.barber.name} undone.`,
                            );
                        }}
                      >
                        Undo
                      </button>
                    )}
                  </p>
                )}
                {owner && !i.barber.owner && (
                  <div className="payout-buttons">
                    {!i.paid && (
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={busy || i.netPence === 0}
                        onClick={() => {
                          const note = prompt(
                            `Mark ${i.barber.name} paid ${money(i.netPence)} pounds for ${periodLabel}. Add a note if you like:`,
                            "",
                          );
                          if (note === null) return;
                          void act(
                            {
                              action: "pay",
                              items: [
                                {
                                  barber_id: i.barber.id,
                                  from,
                                  to,
                                  amount_pence: i.netPence,
                                  sales_pence: i.salesPence,
                                  card_pence: i.cardPence,
                                  cash_pence: i.cashPence,
                                  note: note.slice(0, 200),
                                },
                              ],
                            },
                            `${i.barber.name} marked paid for ${periodLabel}.`,
                          );
                        }}
                      >
                        Mark paid
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setEditing(editing === i.barber.id ? null : i.barber.id)
                      }
                    >
                      {editing === i.barber.id ? "Close" : "Rules and bank"}
                    </button>
                  </div>
                )}
                {owner && editing === i.barber.id && (
                  <RuleForm
                    rule={i.rule}
                    busy={busy}
                    onSave={(rule) =>
                      act(
                        { action: "rules", ...rule },
                        `${i.barber.name}'s rules saved.`,
                      )
                    }
                  />
                )}
              </article>
            ))}
          </div>
          {current.history.length > 0 && (
            <>
              <h2>{owner ? "Payouts recorded" : "Paid to you"}</h2>
              <div className="grid-wrap">
                <table className="grid-table payout-history">
                  <thead>
                    <tr>
                      <th scope="col">Paid</th>
                      {owner && <th scope="col">Barber</th>}
                      <th scope="col">Period</th>
                      <th scope="col">Note</th>
                      <th scope="col" className="num">
                        Pounds
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.history.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {new Date(p.paid_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            timeZone: "Europe/London",
                          })}
                        </td>
                        {owner && <td>{p.barber}</td>}
                        <td>
                          {shortDay(p.period_start)} to {shortDay(p.period_end)}
                        </td>
                        <td>{p.note}</td>
                        <td className="num">{money(p.amount_pence)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <p className="staff-muted">
            “Pay everyone” and “Mark paid” record the payout here; the transfer
            itself is made from the shop’s bank. The bank file is a CSV for a
            bulk payment with each barber’s name, sort code, account number and
            amount, using the details saved under Rules and bank.
          </p>
        </>
      )}
    </section>
  );
}

function RuleForm({
  rule,
  busy,
  onSave,
}: {
  rule: Rule;
  busy: boolean;
  onSave: (rule: Rule) => Promise<void>;
}) {
  return (
    <form
      className="staff-form inline-editor"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void onSave({
          barber_id: rule.barber_id,
          share_percent: Number(form.get("share")),
          weekly_rent_pence: Math.round(Number(form.get("rent") || 0) * 100),
          keeps_cash: form.get("cash") === "on",
          bank_name: String(form.get("bank_name") || ""),
          bank_sort_code: String(form.get("sort") || ""),
          bank_account: String(form.get("account") || ""),
        });
      }}
    >
      <label>
        Chair rent per week (pounds)
        <input
          name="rent"
          type="number"
          min="0"
          step="0.5"
          defaultValue={rule.weekly_rent_pence / 100}
        />
      </label>
      <label>
        Share of sales they keep (%)
        <input
          name="share"
          type="number"
          min="0"
          max="100"
          required
          defaultValue={rule.share_percent}
        />
      </label>
      <label className="check wide">
        <input type="checkbox" name="cash" defaultChecked={rule.keeps_cash} />
        <span>Keeps the cash they take on the day</span>
      </label>
      <label className="wide">
        Name on the bank account (for the bank file)
        <input name="bank_name" defaultValue={rule.bank_name} maxLength={80} />
      </label>
      <label>
        Sort code
        <input
          name="sort"
          inputMode="numeric"
          placeholder="123456"
          defaultValue={rule.bank_sort_code}
        />
      </label>
      <label>
        Account number
        <input
          name="account"
          inputMode="numeric"
          placeholder="12345678"
          defaultValue={rule.bank_account}
        />
      </label>
      <p className="price-hint">
        Bank details are optional and only the owner sees them. Leave them blank
        to fill the bank file in by hand.
      </p>
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={busy}>
          Save rules
        </button>
      </div>
    </form>
  );
}
