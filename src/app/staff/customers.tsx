"use client";
import { useEffect, useState } from "react";
import { staffApi } from "@/lib/staff-client";
import { clock, money } from "@/lib/booking-data";
type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferences: string;
  created_at: string;
};
type Booking = {
  id: string;
  local_date: string;
  start_minute: number;
  duration: number;
  price_pence: number;
  status: string;
  barbers: { name: string };
  services: { name: string };
};
export function Customers() {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [id, setId] = useState<string | null>(null),
    [period, setPeriod] = useState("upcoming"),
    [rows, setRows] = useState<Customer[]>([]),
    [customer, setCustomer] = useState<Customer | null>(null),
    [draft, setDraft] = useState<Customer | null>(null),
    [bookings, setBookings] = useState<Booking[]>([]),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [editing, setEditing] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    staffApi(
      `/api/staff/customers?${new URLSearchParams(id ? { id, period, page: String(page) } : { q: query, page: String(page) })}`,
    )
      .then((data) => {
        if (!active) return;
        if (id) {
          setCustomer(data.customer);
          setDraft(data.customer);
          setBookings(data.bookings);
        } else setRows(data.customers);
        setCount(data.count || 0);
        setLoading(false);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, query, page, period]);
  function navigate(nextId: string | null) {
    setLoading(true);
    setError("");
    setMessage("");
    setEditing(false);
    setId(nextId);
    setPage(0);
    setPeriod("upcoming");
  }
  return (
    <section className="customer-panel" aria-label="Customers">
      {id ? (
        <button className="quiet-button" onClick={() => navigate(null)}>
          ← customers
        </button>
      ) : (
        <>
          <h2>customers.</h2>
          <form
            className="customer-search"
            onSubmit={(e) => {
              e.preventDefault();
              if (query !== search.trim() || page !== 0) {
                setLoading(true);
                setError("");
                setQuery(search.trim());
                setPage(0);
              }
            }}
          >
            <label htmlFor="customer-search">
              Search name, email or mobile
            </label>
            <div>
              <input
                id="customer-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button>search</button>
            </div>
          </form>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Loading…</p>
      ) : (
        !error && (
          <>
            {!id ? (
              <>
                <p>
                  {count} {count === 1 ? "customer" : "customers"}
                </p>
                <div className="customer-results">
                  {rows.map((c) => (
                    <button key={c.id} onClick={() => navigate(c.id)}>
                      <strong>{c.name}</strong>
                      <span>{c.email}</span>
                      <span>{c.phone || "No mobile recorded"}</span>
                      <span>view profile →</span>
                    </button>
                  ))}
                </div>
                {!rows.length && (
                  <p>
                    No customers found. Try a different name or contact detail.
                  </p>
                )}
              </>
            ) : (
              customer && (
                <>
                  <div className="customer-profile">
                    <h2>{customer.name}</h2>
                    <p>
                      <a href={`mailto:${customer.email}`}>{customer.email}</a>
                    </p>
                    {customer.phone && (
                      <p>
                        <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                      </p>
                    )}
                    <p>
                      Customer since{" "}
                      {new Date(customer.created_at).toLocaleDateString(
                        "en-GB",
                      )}
                    </p>
                    {customer.preferences && <p>{customer.preferences}</p>}
                    <button
                      className="quiet-button"
                      onClick={() => {
                        setDraft(customer);
                        setEditing(!editing);
                        setMessage("");
                      }}
                    >
                      {" "}
                      {editing ? "cancel editing" : "edit details"}
                    </button>
                  </div>
                  {editing && draft && (
                    <form
                      className="details-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setSaving(true);
                        setMessage("");
                        try {
                          const pick = (c: Customer) => ({
                            name: c.name,
                            email: c.email,
                            phone: c.phone,
                            preferences: c.preferences,
                          });
                          const data = await staffApi("/api/staff/customers", {
                            id,
                            original: pick(customer),
                            changes: pick(draft),
                          });
                          setCustomer(data.customer);
                          setDraft(data.customer);
                          setEditing(false);
                          setMessage("Customer details saved.");
                        } catch (e) {
                          setMessage((e as Error).message);
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      <label>
                        name
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
                        email
                        <input
                          type="email"
                          required
                          value={draft.email}
                          onChange={(e) =>
                            setDraft({ ...draft, email: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        mobile, including country code
                        <input
                          type="tel"
                          required
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
                      <label>
                        customer preferences
                        <textarea
                          maxLength={1000}
                          value={draft.preferences}
                          onChange={(e) =>
                            setDraft({ ...draft, preferences: e.target.value })
                          }
                        />
                      </label>
                      <p>
                        Email changes affect where booking messages and recovery
                        links are sent. Preferences may also be updated by the
                        customer when booking.
                      </p>
                      <button disabled={saving}>
                        {saving ? "saving…" : "save details"}
                      </button>
                    </form>
                  )}
                  {!editing && (
                    <>
                      <div className="customer-period">
                        {["upcoming", "past"].map((p) => (
                          <button
                            key={p}
                            aria-pressed={period === p}
                            onClick={() => {
                              if (p !== period) {
                                setLoading(true);
                                setPeriod(p);
                                setPage(0);
                              }
                            }}
                          >
                            {p === "past"
                              ? "past bookings"
                              : "upcoming bookings"}
                          </button>
                        ))}
                      </div>
                      <p>
                        {count} {count === 1 ? "booking" : "bookings"} · prices
                        in pounds
                      </p>
                      <div className="customer-history">
                        {bookings.map((b) => (
                          <article key={b.id}>
                            <strong>
                              {new Date(
                                b.local_date + "T12:00:00",
                              ).toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}{" "}
                              · {clock(b.start_minute)}
                            </strong>
                            <p>
                              {b.services.name} with {b.barbers.name}
                            </p>
                            <p>
                              {b.duration} min · {money(b.price_pence / 100)} ·{" "}
                              {b.status.replaceAll("_", " ")}
                            </p>
                          </article>
                        ))}
                      </div>
                      {!bookings.length && <p>No {period} bookings.</p>}
                    </>
                  )}
                </>
              )
            )}
            {!editing && count > 20 && (
              <div className="customer-pagination">
                <button
                  disabled={page === 0}
                  onClick={() => {
                    setLoading(true);
                    setPage(page - 1);
                  }}
                >
                  previous
                </button>
                <span>
                  Page {page + 1} of {Math.ceil(count / 20)}
                </span>
                <button
                  disabled={(page + 1) * 20 >= count}
                  onClick={() => {
                    setLoading(true);
                    setPage(page + 1);
                  }}
                >
                  next
                </button>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
