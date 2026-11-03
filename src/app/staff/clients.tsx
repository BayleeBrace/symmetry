"use client";
import { useEffect, useState } from "react";
import { staffApi as api } from "@/lib/staff-client";
import { clock, money } from "@/lib/booking-data";
import { type Context, displayPhone, initials, shortDay } from "./types";
import { SheetIcon } from "./timeline";
import { type Waiting, WaitingRow } from "./forms";
import { toast } from "./toast";
import { Loading } from "./spinner";
import { EditorHead, InlineEditor } from "./dialog";

/** Everyone waiting for a day in the next two months, day by day. */
function WaitingList({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<Waiting[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api("/api/staff/waitlist")
      .then((d) => {
        if (live) setRows(d.waiting as Waiting[]);
      })
      .catch((e) => {
        if (live) setError((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [tick]);
  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api("/api/staff/waitlist", { action: "remove", id });
      setTick((t) => t + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const days = [...new Set((rows ?? []).map((w) => w.date))];
  return (
    <section className="clients" aria-label="Waitlist">
      <button type="button" className="text-button back-link" onClick={onBack}>
        ‹ All clients
      </button>
      <header className="sec-head">
        <h1>Waitlist</h1>
      </header>
      <p className="staff-muted">
        People waiting for a day that was full. When a slot frees, the first
        person is offered it by text or email, then the next five minutes later.
      </p>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {!rows ? (
        <Loading>Loading…</Loading>
      ) : rows.length === 0 ? (
        <p className="staff-muted">Nobody is waiting.</p>
      ) : (
        days.map((day) => (
          <div key={day} className="wait-day">
            <h3 className="wait-heading">{shortDay(day)}</h3>
            <ul className="wait-list">
              {rows
                .filter((w) => w.date === day)
                .map((w) => (
                  <WaitingRow key={w.id} w={w} busy={busy} onRemove={remove} />
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferences: string;
  created_at: string;
};
type Visit = {
  id: string;
  local_date: string;
  start_minute: number;
  duration: number;
  price_pence: number;
  status: string;
  paid_by: string | null;
  barbers: { name: string } | null;
  services: { name: string } | null;
};
type Stats = {
  visits: number;
  noShows: number;
  cancelled: number;
  spent: number;
  upcoming: number;
};

const STATUS: Record<string, string> = {
  booked: "Booked",
  arrived: "In the chair",
  done: "Done",
  no_show: "No show",
  cancelled: "Cancelled",
};

export function Clients({
  ctx,
  onBook,
}: {
  ctx: Context;
  onBook: (client: {
    id: string;
    name: string;
    email: string;
    phone: string;
  }) => void;
}) {
  const owner = ctx.staff.role === "owner";
  const [showWaiting, setShowWaiting] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [id, setId] = useState<string | null>(null);
  const [period, setPeriod] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<Client[] | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [count, setCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const t = setTimeout(
      () => {
        api(
          `/api/staff/customers?${new URLSearchParams(
            id
              ? { id, period, page: String(page) }
              : { q: query, page: String(page) },
          )}`,
        )
          .then((data) => {
            if (!live) return;
            if (id) {
              setClient(data.customer);
              setStats(data.stats);
              setVisits(data.bookings);
            } else setRows(data.customers);
            setCount(data.count || 0);
            setError("");
          })
          .catch((e) => {
            if (live) setError((e as Error).message);
          });
      },
      query || id ? 0 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [id, query, page, period]);

  // The list filters as you type; Enter searches straight away.
  useEffect(() => {
    const term = search.trim();
    if (term === query) return;
    const t = setTimeout(() => {
      setQuery(term);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search, query]);

  const open = (next: string | null) => {
    setError("");
    setEditing(false);
    setId(next);
    setPage(0);
    setPeriod("upcoming");
    if (next) {
      setClient(null);
      setStats(null);
      setVisits([]);
    }
  };

  if (id)
    return (
      <section className="clients" aria-label="Client">
        <div className="client-bar">
          <button
            type="button"
            className="text-button back-link"
            onClick={() => open(null)}
          >
            <SheetIcon d="M15 5l-7 7 7 7" />
            Clients
          </button>
          {owner && client && (
            <button
              type="button"
              className="text-button"
              aria-expanded={editing}
              onClick={() => {
                setDraft(client);
                setEditing((e) => !e);
              }}
            >
              {editing ? "Stop editing" : "Edit"}
            </button>
          )}
        </div>
        {error && (
          <p className="staff-error" role="alert">
            {error}
          </p>
        )}
        {!client ? (
          <Loading>Loading…</Loading>
        ) : (
          <>
            <header className="client-head">
              <span className="avatar is-large">{initials(client.name)}</span>
              <div>
                <h1>{client.name}</h1>
                <p className="staff-muted">
                  Client since{" "}
                  {new Date(client.created_at).toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                  {client.phone ? ` · ${displayPhone(client.phone)}` : ""}
                </p>
              </div>
            </header>
            {client.phone || client.email ? (
              <div className="contact-buttons">
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    aria-label={`Call ${displayPhone(client.phone)}`}
                  >
                    <SheetIcon d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                    Call
                  </a>
                )}
                {client.phone && (
                  <a
                    href={`sms:${client.phone}`}
                    aria-label={`Text ${displayPhone(client.phone)}`}
                  >
                    <SheetIcon d="M4 5h16v11H9l-5 4z" />
                    Text
                  </a>
                )}
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    aria-label={`Email ${client.email}`}
                  >
                    <SheetIcon d="M3 5h18v14H3zM3.5 6.5L12 13l8.5-6.5" />
                    Email
                  </a>
                )}
              </div>
            ) : (
              <p className="staff-muted">No contact details</p>
            )}
            {client.email && <p className="client-email">{client.email}</p>}
            {stats && (
              <dl className="stat-line">
                {[
                  ["Visits", String(stats.visits)],
                  ["Spent", `£${money(stats.spent / 100)}`],
                  ["No shows", String(stats.noShows)],
                  ["Cancelled", String(stats.cancelled)],
                ].map(([label, value]) => (
                  <div
                    className={
                      label === "No shows" && stats.noShows ? "is-warn" : ""
                    }
                    key={label}
                  >
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <button
              type="button"
              className="button-primary client-book"
              onClick={() =>
                onBook({
                  id: client.id,
                  name: client.name,
                  email: client.email,
                  phone: client.phone,
                })
              }
            >
              New appointment
            </button>
            {client.preferences && (
              <div className="sheet-notes">
                <span className="sheet-notes-label">Notes</span>
                <p>{client.preferences}</p>
              </div>
            )}
            {editing && draft && (
              <InlineEditor
                onClose={() => setEditing(false)}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true);
                  try {
                    const pick = (c: Client) => ({
                      name: c.name,
                      email: c.email,
                      phone: c.phone,
                      preferences: c.preferences,
                    });
                    const data = await api("/api/staff/customers", {
                      id,
                      original: pick(client),
                      changes: pick(draft),
                    });
                    setClient(data.customer);
                    setDraft(data.customer);
                    setEditing(false);
                    toast("Details saved.");
                  } catch (err) {
                    toast((err as Error).message, "error");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <EditorHead
                  title={`Details for ${client.name}`}
                  onClose={() => setEditing(false)}
                />
                <label>
                  Name
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) =>
                      setDraft({ ...draft, email: e.target.value })
                    }
                  />
                </label>
                <label>
                  Mobile, with country code
                  <input
                    type="tel"
                    placeholder="+44"
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        phone: e.target.value.replace(/[\s()-]/g, ""),
                      })
                    }
                  />
                </label>
                <label className="wide">
                  Preferences (the client can see these)
                  <textarea
                    maxLength={1000}
                    value={draft.preferences}
                    onChange={(e) =>
                      setDraft({ ...draft, preferences: e.target.value })
                    }
                  />
                </label>
                <p className="price-hint">
                  Booking messages and recovery links go to the email here.
                </p>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="button-primary"
                    disabled={saving}
                  >
                    Save details
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </InlineEditor>
            )}
            <div className="seg is-tabs" role="group" aria-label="Appointments">
              {(["upcoming", "past"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => {
                    if (p !== period) {
                      setPeriod(p);
                      setPage(0);
                    }
                  }}
                >
                  {p === "past" ? "Past" : "Upcoming"}
                </button>
              ))}
            </div>
            <p className="staff-muted">
              {count} {count === 1 ? "appointment" : "appointments"}
            </p>
            <div className="visit-list">
              {visits.map((v) => (
                <article key={v.id} className={`visit status-${v.status}`}>
                  <span className="visit-when">
                    <strong>{shortDay(v.local_date)}</strong>
                    <small>{clock(v.start_minute)}</small>
                  </span>
                  <span className="visit-what">
                    <strong>{v.services?.name ?? "Trim"}</strong>
                    <small>
                      with {v.barbers?.name ?? "chair"} · {v.duration} min
                    </small>
                  </span>
                  <span className="visit-how">
                    <strong>£{money(v.price_pence / 100)}</strong>
                    <small>
                      {STATUS[v.status] ?? v.status}
                      {v.paid_by ? ` · ${v.paid_by}` : ""}
                    </small>
                  </span>
                </article>
              ))}
              {!visits.length && (
                <p className="staff-muted">No {period} appointments.</p>
              )}
            </div>
            <Pager page={page} count={count} onPage={setPage} />
          </>
        )}
      </section>
    );

  if (showWaiting) return <WaitingList onBack={() => setShowWaiting(false)} />;

  return (
    <section className="clients" aria-label="Clients">
      <header className="sec-head">
        <h1>Clients</h1>
        <button
          type="button"
          className="button-secondary"
          onClick={() => setShowWaiting(true)}
        >
          Waitlist
        </button>
        <form
          className="client-search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
            setPage(0);
          }}
        >
          <SheetIcon d="M11 4.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM16 16l4.5 4.5" />
          <input
            type="search"
            aria-label="Search clients"
            placeholder="Name, mobile or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </header>
      {error && (
        <p className="staff-error" role="alert">
          {error}
        </p>
      )}
      {!rows ? (
        <Loading>Loading…</Loading>
      ) : (
        <>
          <p className="staff-muted">
            {count} {count === 1 ? "client" : "clients"}
            {query ? ` matching “${query}”` : ""}
          </p>
          <div className="client-list">
            {rows.map((c) => (
              <button
                key={c.id}
                type="button"
                className="client-row"
                onClick={() => open(c.id)}
              >
                <span className="avatar">{initials(c.name)}</span>
                <span className="client-name">{c.name}</span>
                <span className="client-meta">
                  {c.phone
                    ? displayPhone(c.phone)
                    : c.email || "No contact details"}
                </span>
                <span className="chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
            {!rows.length && (
              <p className="staff-muted">
                No clients found. Try a different name or contact detail.
              </p>
            )}
          </div>
          <Pager page={page} count={count} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function Pager({
  page,
  count,
  onPage,
}: {
  page: number;
  count: number;
  onPage: (page: number) => void;
}) {
  if (count <= 20) return null;
  return (
    <div className="pager">
      <button
        type="button"
        className="btn-quiet"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page + 1} of {Math.ceil(count / 20)}
      </span>
      <button
        type="button"
        className="btn-quiet"
        disabled={(page + 1) * 20 >= count}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
